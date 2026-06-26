import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { ratings, users } from "@db/schema";
import { eq, desc, avg, sql } from "drizzle-orm";

export const ratingsRouter = createRouter({
  // ─── Reviews ───
  getForUser: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const reviews = await db
        .select()
        .from(ratings)
        .where(eq(ratings.revieweeId, input.userId))
        .orderBy(desc(ratings.createdAt));

      // Get average rating
      const avgResult = await db
        .select({ average: avg(ratings.rating) })
        .from(ratings)
        .where(eq(ratings.revieweeId, input.userId));

      return {
        reviews,
        averageRating: Number(avgResult[0]?.average ?? 0),
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const reviewerId = ctx.user.id;

      // Prevent self-rating
      if (reviewerId === input.revieweeId) {
        throw new Error("Cannot rate yourself");
      }

      await db.insert(ratings).values({
        reviewerId,
        revieweeId: input.revieweeId,
        orderId: input.orderId ?? null,
        rating: input.rating,
        review: input.review,
        tags: input.tags ?? [],
      });

      // Update user's average rating
      const avgResult = await db
        .select({ average: avg(ratings.rating) })
        .from(ratings)
        .where(eq(ratings.revieweeId, input.revieweeId));

      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ratings)
        .where(eq(ratings.revieweeId, input.revieweeId));

      await db
        .update(users)
        .set({
          rating: String(avgResult[0]?.average ?? 0),
          reviewCount: Number(countResult[0]?.count ?? 0),
        })
        .where(eq(users.id, input.revieweeId));

      return { success: true };
    }),
});
