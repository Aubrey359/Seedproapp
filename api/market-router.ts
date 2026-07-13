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

  create: authedQuery
    .input(
      z.object({
        cropName: z.string().min(1),
        quantity: z.number().positive(),
        quantityUnit: z.string().default("kg"),
        location: z.string().min(1),
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

  myOrders: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    return omitMongo(
      await orders
        .find({ $or: [{ buyerId: userId }, { farmerId: userId }] })
        .sort({ createdAt: -1 })
        .lean(),
    );
  }),

  updateOrderStatus: authedQuery
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["pending", "confirmed", "in_transit", "delivered", "cancelled"]),
      }),
    )
    .mutation(async ({ input }) => {
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
