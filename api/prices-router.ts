import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { marketPrices, priceAlerts, nextSeq } from "@db/schema";

export const pricesRouter = createRouter({
  // ─── Market Prices ───
  getByTown: publicQuery
    .input(z.object({ town: z.string() }))
    .query(async ({ input }) => {
      const today = new Date().toISOString().split("T")[0];
      return marketPrices
        .find({ town: input.town, priceDate: today })
        .sort({ cropName: 1 })
        .lean();
    }),

  getTrends: publicQuery
    .input(
      z.object({
        cropName: z.string(),
        town: z.string(),
        days: z.number().default(7),
      }),
    )
    .query(async ({ input }) => {
      return marketPrices
        .find({ cropName: input.cropName, town: input.town })
        .sort({ priceDate: -1 })
        .limit(input.days)
        .lean();
    }),

  getTowns: publicQuery.query(async () => {
    const towns = await marketPrices.distinct("town");
    return towns as string[];
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await nextSeq("price_alerts");
      await priceAlerts.create({
        id,
        userId: ctx.user.id,
        cropName: input.cropName,
        town: input.town ?? null,
        condition: input.condition,
        targetPrice: input.targetPrice,
        notificationMethod: input.notificationMethod,
        active: true,
        triggered: false,
      });
      return { id };
    }),

  getMyAlerts: authedQuery.query(async ({ ctx }) => {
    return priceAlerts.find({ userId: ctx.user.id }).sort({ createdAt: -1 }).lean();
  }),

  deleteAlert: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await priceAlerts.deleteOne({ id: input.id });
      return { success: true };
    }),
});
