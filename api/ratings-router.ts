import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { ratings, users, nextSeq } from "@db/schema";

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
        reviews,
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
        review: z.string().min(1),
        tags: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reviewerId = ctx.user.id;

      // Prevent self-rating
      if (reviewerId === input.revieweeId) {
        throw new Error("Cannot rate yourself");
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
