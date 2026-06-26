import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { marketPrices, priceAlerts } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const pricesRouter = createRouter({
  // ─── Market Prices ───
  getByTown: publicQuery
    .input(z.object({ town: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(marketPrices)
        .where(
          and(
            eq(marketPrices.town, input.town),
            sql`DATE(${marketPrices.priceDate}) = CURDATE()`
          )
        )
        .orderBy(marketPrices.cropName);
    }),

  getTrends: publicQuery
    .input(
      z.object({
        cropName: z.string(),
        town: z.string(),
        days: z.number().default(7),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(marketPrices)
        .where(
          and(
            eq(marketPrices.cropName, input.cropName),
            eq(marketPrices.town, input.town)
          )
        )
        .orderBy(desc(marketPrices.priceDate))
        .limit(input.days);
    }),

  getTowns: publicQuery.query(async () => {
    const db = getDb();
    const result = await db
      .select({ town: marketPrices.town })
      .from(marketPrices)
      .groupBy(marketPrices.town);
    return result.map((r) => r.town);
  }),

  // ─── Price Alerts ───
  createAlert: authedQuery
    .input(
      z.object({
        cropName: z.string(),
        town: z.string().optional(),
        condition: z.enum(["above", "below"]),
        targetPrice: z.number().positive(),
        notificationMethod: z.enum(["whatsapp", "sms", "in_app"]).default("in_app"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const result = await db.insert(priceAlerts).values({
        userId: ctx.user.id,
        cropName: input.cropName,
        town: input.town ?? null,
        condition: input.condition,
        targetPrice: input.targetPrice.toString(),
        notificationMethod: input.notificationMethod,
        active: true,
        triggered: false,
      });
      return { id: Number(result[0].insertId) };
    }),

  getMyAlerts: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, ctx.user.id))
      .orderBy(desc(priceAlerts.createdAt));
  }),

  deleteAlert: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(priceAlerts).where(eq(priceAlerts.id, input.id));
      return { success: true };
    }),
});
