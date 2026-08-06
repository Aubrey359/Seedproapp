import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { farmerPosts, listings, users, nextSeq } from "@db/schema";

// Same reasoning as the OTP resend cooldown elsewhere — not abuse-proofing
// against a hostile actor, just stopping an accidental double-tap or a
// careless flood from filling the feed.
const POST_COOLDOWN_MS = 30 * 1000;
const FEED_LIMIT = 50;

export const farmerPostsRouter = createRouter({
  // Public "Farmer Updates" feed — visible to every consumer, not just
  // signed-in farmers, same as the rest of Farmer Next Door.
  list: publicQuery.query(async () => {
    const rows = await farmerPosts.find({}).sort({ createdAt: -1 }).limit(FEED_LIMIT).lean();
    if (!rows.length) return [];

    const farmerIds = [...new Set(rows.map((r: any) => r.farmerId))];
    const listingIds = [...new Set(rows.map((r: any) => r.listingId).filter((id: any) => id != null))];
    const [farmerRows, listingRows] = await Promise.all([
      users.find({ id: { $in: farmerIds } }).lean(),
      listingIds.length ? listings.find({ id: { $in: listingIds } }).lean() : Promise.resolve([]),
    ]);
    const farmerMap = new Map(farmerRows.map((f: any) => [f.id, f]));
    const listingMap = new Map(listingRows.map((l: any) => [l.id, l]));

    return rows.map((r: any) => {
      const farmer: any = farmerMap.get(r.farmerId);
      const listing: any = r.listingId ? listingMap.get(r.listingId) : null;
      return {
        id: r.id,
        content: r.content,
        updateType: r.updateType,
        createdAt: r.createdAt,
        farmerId: r.farmerId,
        farmerName: farmer?.name ?? "Farmer",
        farmerAvatar: farmer?.avatar ?? null,
        farmerVerified: !!farmer?.verified,
        // cropName falls back to the snapshot taken at post time so the
        // feed still reads sensibly if the listing was since removed.
        cropName: listing?.cropName ?? r.cropName ?? null,
        listing: listing
          ? {
              id: listing.id,
              quantity: listing.quantity,
              quantityUnit: listing.quantityUnit,
              expectedPrice: listing.expectedPrice,
              currency: listing.currency,
              status: listing.status,
            }
          : null,
      };
    });
  }),

  create: authedQuery
    .input(
      z.object({
        content: z.string().min(1).max(500),
        listingId: z.number().optional(),
        action: z.enum(["none", "restocked", "sold_out"]).default("none"),
        newQuantity: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lastPost: any = await farmerPosts
        .findOne({ farmerId: ctx.user.id })
        .sort({ createdAt: -1 })
        .lean();
      if (lastPost && Date.now() - new Date(lastPost.createdAt).getTime() < POST_COOLDOWN_MS) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait a moment before posting again" });
      }

      let cropName: string | undefined;
      if (input.listingId != null) {
        const listing: any = await listings.findOne({ id: input.listingId }).lean();
        if (!listing) throw new TRPCError({ code: "BAD_REQUEST", message: "That listing no longer exists" });
        if (listing.farmerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own listings" });
        }
        cropName = listing.cropName;

        if (input.action === "sold_out") {
          await listings.updateOne({ id: input.listingId }, { $set: { status: "sold" } });
        } else if (input.action === "restocked") {
          if (input.newQuantity == null) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the new quantity available" });
          }
          await listings.updateOne(
            { id: input.listingId },
            { $set: { quantity: input.newQuantity, status: "active" } },
          );
        }
      }

      const id = await nextSeq("farmer_posts");
      await farmerPosts.create({
        id,
        farmerId: ctx.user.id,
        content: input.content,
        listingId: input.listingId ?? null,
        cropName: cropName ?? null,
        updateType: input.action === "none" ? "note" : input.action,
      });

      return { id };
    }),
});
