import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { listings, orders, crops, users, nextSeq, omitMongo } from "@db/schema";
import { CURRENCY } from "@contracts/kenya";
import { findOrCreateFarmerByPhone } from "./lib/identity";
import { alertBuyersOfListing } from "./whatsapp/notify";

// Farmers earn the green verified-seller badge automatically once they've
// proven themselves with real completed sales — not just a signup checkbox.
const VERIFIED_SELLER_ORDER_THRESHOLD = 5;

// Attach farmer info to a listing row (replaces the old SQL leftJoin on users).
function withFarmer(r: any, f: any, extra: "card" | "detail") {
  const base = {
    id: r.id,
    farmerId: r.farmerId,
    cropId: r.cropId,
    cropName: r.cropName,
    quantity: r.quantity,
    quantityUnit: r.quantityUnit,
    location: r.location,
    harvestDate: r.harvestDate ?? null,
    expectedPrice: r.expectedPrice,
    currency: r.currency,
    description: r.description ?? null,
    images: r.images ?? [],
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    farmerName: f?.name ?? null,
    farmerRating: f?.rating ?? null,
    farmerVerified: f?.verified ?? null,
    farmerPremium: f?.premium ?? null,
  };
  return extra === "card"
    ? { ...base, farmerAvatar: f?.avatar ?? null }
    : { ...base, farmerPhone: f?.phone ?? null };
}

export const marketRouter = createRouter({
  // ─── Listings ───
  list: publicQuery
    .input(
      z
        .object({
          cropType: z.string().optional(),
          location: z.string().optional(),
          category: z.string().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = { status: "active" };
      if (input?.cropType && input.cropType !== "all") filter.cropName = input.cropType;
      if (input?.location) filter.location = { $regex: input.location, $options: "i" };
      if (input?.search) {
        filter.$or = [
          { cropName: { $regex: input.search, $options: "i" } },
          { location: { $regex: input.search, $options: "i" } },
        ];
      }

      const rows = await listings.find(filter).sort({ createdAt: -1 }).lean();
      const farmerIds = [...new Set(rows.map((r: any) => r.farmerId))];
      const farmers = await users.find({ id: { $in: farmerIds } }).lean();
      const byId = new Map(farmers.map((f: any) => [f.id, f]));
      const withFarmers = rows.map((r: any) => withFarmer(r, byId.get(r.farmerId), "card"));

      // Premium sellers rank higher in search/browse results. Array.sort is
      // stable, so listings keep their newest-first order within each tier.
      return withFarmers.sort(
        (a: any, b: any) => (b.farmerPremium ? 1 : 0) - (a.farmerPremium ? 1 : 0),
      );
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const r: any = await listings.findOne({ id: input.id }).lean();
      if (!r) return null;
      const f: any = await users.findOne({ id: r.farmerId }).lean();
      return withFarmer(r, f, "detail");
    }),

  // "Farmer Next Door" — real verified farmers with real listing counts (via
  // aggregation, not a hardcoded number), for a homepage discovery section.
  // Sorting by the buyer's chosen location happens client-side, same as the
  // Shop page's "near me" sort — no separate server-side geo logic to keep
  // in sync with it.
  nearbyFarmers: publicQuery.query(async () => {
    const farmers = await users.find({ userType: "farmer", verified: true }).lean();
    const farmerIds = farmers.map((f: any) => f.id);
    const counts = await listings.aggregate([
      { $match: { farmerId: { $in: farmerIds }, status: "active" } },
      { $group: { _id: "$farmerId", n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [c._id, c.n]));
    return farmers.map((f: any) => ({
      id: f.id,
      name: f.name,
      location: f.location,
      ward: f.ward ?? null,
      avatar: f.avatar ?? null,
      rating: f.rating ?? 0,
      reviewCount: f.reviewCount ?? 0,
      listingCount: countMap.get(f.id) ?? 0,
      phone: f.phone ?? null,
      premium: !!f.premium,
    }));
  }),

  create: authedQuery
    .input(
      z.object({
        cropName: z.string().min(1),
        quantity: z.number().positive(),
        quantityUnit: z.string().default("kg"),
        location: z.string().min(1),
        ward: z.string().optional(),
        harvestDate: z.string().optional(),
        expectedPrice: z.number().positive(),
        currency: z.string().default(CURRENCY),
        description: z.string().optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const crop: any = await crops.findOne({ name: input.cropName }).lean();
      const cropId = crop?.id ?? 1;
      const id = await nextSeq("listings");

      const newListing = {
        id,
        farmerId: ctx.user.id,
        cropId,
        cropName: input.cropName,
        quantity: input.quantity,
        quantityUnit: input.quantityUnit,
        location: input.location,
        harvestDate: input.harvestDate ? new Date(input.harvestDate) : null,
        expectedPrice: input.expectedPrice,
        currency: input.currency,
        description: input.description ?? null,
        images: input.images ?? [],
        status: "active",
      };
      await listings.create(newListing);
      alertBuyersOfListing(newListing).catch(() => {});

      return { id };
    }),

  // Batch version of createOrder for cart checkout (which can span multiple
  // listings/farmers in one go). Price/farmerId are derived from the live
  // listing server-side — never trust cart totals from the client.
  createOrders: authedQuery
    .input(
      z.object({
        items: z
          .array(
            z.object({
              listingId: z.number(),
              quantity: z.number().positive(),
            }),
          )
          .min(1),
        deliveryMethod: z.enum(["pickup", "delivery"]).default("pickup"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orderIds: number[] = [];
      for (const item of input.items) {
        const listing: any = await listings.findOne({ id: item.listingId }).lean();
        if (!listing) continue; // stale cart entry (listing sold/removed) — skip, don't fail the whole checkout

        const id = await nextSeq("orders");
        await orders.create({
          id,
          listingId: listing.id,
          buyerId: ctx.user.id,
          farmerId: listing.farmerId,
          quantity: item.quantity,
          price: listing.expectedPrice,
          totalAmount: listing.expectedPrice * item.quantity,
          deliveryMethod: input.deliveryMethod,
          notes: input.notes ?? null,
          status: "pending",
        });
        orderIds.push(id);
      }

      if (!orderIds.length) throw new Error("None of the items in your cart are available anymore");
      return { orderIds };
    }),

  // Public equivalent of `create` for the website's Sell form, which has no
  // login system — the farmer's phone number is their identity, same as the
  // WhatsApp bot. Finds-or-creates the farmer, then creates the listing.
  createPublic: publicQuery
    .input(
      z.object({
        cropName: z.string().min(1),
        quantity: z.number().positive(),
        quantityUnit: z.string().default("kg"),
        location: z.string().min(1),
        ward: z.string().optional(),
        expectedPrice: z.number().positive(),
        description: z.string().optional(),
        farmerName: z.string().min(1),
        farmerPhone: z.string().min(9),
        images: z
          .array(
            z.string().refine((s) => s.startsWith("data:image/") && s.length <= 400_000, {
              message: "Photo must be a valid image under ~300KB",
            }),
          )
          .max(1)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const farmer = await findOrCreateFarmerByPhone(input.farmerPhone, input.farmerName);
      const crop: any = await crops.findOne({ name: input.cropName }).lean();
      const id = await nextSeq("listings");

      const newListing = {
        id,
        farmerId: farmer.id,
        cropId: crop?.id ?? 1,
        cropName: input.cropName,
        quantity: input.quantity,
        quantityUnit: input.quantityUnit,
        location: input.location,
        expectedPrice: input.expectedPrice,
        currency: CURRENCY,
        description: input.description ?? null,
        images: input.images ?? [],
        status: "active",
      };
      await listings.create(newListing);
      alertBuyersOfListing(newListing).catch(() => {});

      // A farmer's ward doesn't change listing-to-listing, and there's no
      // separate profile-edit screen on the website yet — piggyback on
      // whatever they enter here so Farmer Next Door's ward filter has
      // real data to work with, not just an empty dropdown.
      if (input.ward && input.ward.trim()) {
        await users.updateOne({ id: farmer.id }, { $set: { ward: input.ward.trim() } });
      }

      return { id };
    }),

  myListings: authedQuery.query(async ({ ctx }) => {
    return omitMongo(await listings.find({ farmerId: ctx.user.id }).sort({ createdAt: -1 }).lean());
  }),

  // ─── Orders ───
  createOrder: authedQuery
    .input(
      z.object({
        listingId: z.number(),
        quantity: z.number().positive(),
        price: z.number().positive(),
        deliveryMethod: z.enum(["pickup", "delivery"]).default("pickup"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listing: any = await listings.findOne({ id: input.listingId }).lean();
      if (!listing) throw new Error("Listing not found");

      const id = await nextSeq("orders");
      await orders.create({
        id,
        listingId: input.listingId,
        buyerId: ctx.user.id,
        farmerId: listing.farmerId,
        quantity: input.quantity,
        price: input.price,
        totalAmount: input.quantity * input.price,
        deliveryMethod: input.deliveryMethod,
        notes: input.notes ?? null,
        status: "pending",
      });

      return { id };
    }),

  // Enriched for the "My Orders" tracker UI — crop name/photo and the
  // counterparty's name/phone, not just raw listingId/buyerId/farmerId
  // numbers, so the frontend can render a real order list in one round trip.
  myOrders: authedQuery.query(async ({ ctx }) => {
    const rows = await orders
      .find({ $or: [{ buyerId: ctx.user.id }, { farmerId: ctx.user.id }] })
      .sort({ createdAt: -1 })
      .lean();
    if (!rows.length) return [];

    const listingIds = [...new Set(rows.map((r: any) => r.listingId))];
    const partyIds = [...new Set(rows.flatMap((r: any) => [r.buyerId, r.farmerId]))];
    const [listingRows, partyRows] = await Promise.all([
      listings.find({ id: { $in: listingIds } }).lean(),
      users.find({ id: { $in: partyIds } }).lean(),
    ]);
    const listingMap = new Map(listingRows.map((l: any) => [l.id, l]));
    const userMap = new Map(partyRows.map((u: any) => [u.id, u]));

    return rows.map((r: any) => {
      const listing: any = listingMap.get(r.listingId);
      const isFarmer = r.farmerId === ctx.user.id;
      const counterparty: any = userMap.get(isFarmer ? r.buyerId : r.farmerId);
      return {
        id: r.id,
        role: isFarmer ? "farmer" : "buyer",
        cropName: listing?.cropName ?? "Produce",
        cropImage: listing?.images?.[0] ?? null,
        quantity: r.quantity,
        quantityUnit: listing?.quantityUnit ?? "kg",
        totalAmount: r.totalAmount,
        deliveryMethod: r.deliveryMethod,
        status: r.status,
        counterpartyName: counterparty?.name ?? "Unknown",
        counterpartyPhone: counterparty?.phone ?? null,
        createdAt: r.createdAt,
      };
    });
  }),

  updateOrderStatus: authedQuery
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["pending", "confirmed", "in_transit", "delivered", "cancelled"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing: any = await orders.findOne({ id: input.orderId }).lean();
      if (!existing) throw new Error("Order not found");
      if (existing.farmerId !== ctx.user.id) {
        throw new Error("Only the seller can update this order's status");
      }

      const order = await orders.findOneAndUpdate(
        { id: input.orderId },
        { $set: { status: input.status } },
      ).lean();

      if (input.status === "delivered" && order) {
        const deliveredCount = await orders.countDocuments({
          farmerId: (order as any).farmerId,
          status: "delivered",
        });
        if (deliveredCount >= VERIFIED_SELLER_ORDER_THRESHOLD) {
          await users.updateOne(
            { id: (order as any).farmerId, verified: { $ne: true } },
            { $set: { verified: true } },
          );
        }
      }

      return { success: true };
    }),
});
