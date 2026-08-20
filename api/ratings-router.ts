import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { ratings, users, orders, nextSeq, omitMongo } from "@db/schema";

function average(rows: any[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  return sum / rows.length;
}

export const ratingsRouter = createRouter({
  // ─── Reviews ───
  getForUser: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const reviews = await ratings
        .find({ revieweeId: input.userId })
        .sort({ createdAt: -1 })
        .lean();

      return {
        reviews: omitMongo(reviews),
        averageRating: average(reviews),
        totalReviews: reviews.length,
      };
    }),

  create: authedQuery
    .input(
      z.object({
        revieweeId: z.number(),
        orderId: z.number().optional(),
        rating: z.number().min(1).max(5),
        review: z.string().min(1).max(1000),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reviewerId = ctx.user.id;

      if (reviewerId === input.revieweeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't rate yourself" });
      }

      // Reviews are only meaningful if tied to a real, completed transaction
      // between these two people — otherwise anyone could rate anyone,
      // which is exactly the kind of fake trust signal this feature exists
      // to replace (see the removed homepage testimonials). The frontend
      // always sends an orderId; this stays optional at the schema level
      // only so the endpoint isn't hard-broken if that ever changes.
      if (input.orderId != null) {
        const order: any = await orders.findOne({ id: input.orderId }).lean();
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        const reviewerIsParty = order.buyerId === reviewerId || order.farmerId === reviewerId;
        const revieweeIsCounterparty =
          (order.buyerId === reviewerId && order.farmerId === input.revieweeId) ||
          (order.farmerId === reviewerId && order.buyerId === input.revieweeId);
        if (!reviewerIsParty || !revieweeIsCounterparty) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This order doesn't involve both of you" });
        }
        if (order.status !== "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You can only review a completed order" });
        }
        const existing = await ratings.findOne({ reviewerId, orderId: input.orderId }).lean();
        if (existing) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You've already reviewed this order" });
        }
      }

      const id = await nextSeq("ratings");
      await ratings.create({
        id,
        reviewerId,
        revieweeId: input.revieweeId,
        orderId: input.orderId ?? null,
        rating: input.rating,
        review: input.review,
        tags: input.tags ?? [],
      });

      // Recompute the reviewee's average rating + review count
      const all = await ratings.find({ revieweeId: input.revieweeId }).lean();
      await users.updateOne(
        { id: input.revieweeId },
        { $set: { rating: average(all), reviewCount: all.length } },
      );

      return { success: true };
    }),
});
