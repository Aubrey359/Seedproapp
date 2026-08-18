import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { marketPrices, priceAlerts, users, nextSeq, omitMongo } from "@db/schema";
import { sendSms } from "./whatsapp/send";

// Checks active, not-yet-triggered alerts for one crop against its just-
// updated prices and texts anyone whose condition now matches. Called right
// after an admin updates today's price — that's the only place prices ever
// actually change in this app, so there's no need for a separate scheduled
// job to poll for changes. One-shot: a matched alert is marked triggered
// and deactivated rather than re-firing on every later update for the same
// crop (a farmer who wants to be notified again can just set a new one).
export async function checkAndFirePriceAlerts(cropName: string, wholesalePrice: number, retailPrice: number): Promise<void> {
  const candidates = await priceAlerts.find({ cropName, active: true, triggered: false }).lean();
  for (const alert of candidates as any[]) {
    const matches = alert.condition === "above"
      ? wholesalePrice >= alert.targetPrice || retailPrice >= alert.targetPrice
      : wholesalePrice <= alert.targetPrice || retailPrice <= alert.targetPrice;
    if (!matches) continue;

    await priceAlerts.updateOne({ id: alert.id }, { $set: { triggered: true, active: false } });

    const user: any = await users.findOne({ id: alert.userId }).lean();
    if (!user?.phone) continue;
    const verb = alert.condition === "above" ? "has gone above" : "has dropped below";
    const price = alert.condition === "above" ? Math.max(wholesalePrice, retailPrice) : Math.min(wholesalePrice, retailPrice);
    sendSms(
      user.phone,
      `Shamba Sokoni: ${cropName} price ${verb} your target of KSh ${alert.targetPrice} — now KSh ${price}/kg. Check Live Prices in the app.`,
    ).catch(() => {});
  }
}

export const pricesRouter = createRouter({
  // ─── Market Prices ───
  getByTown: publicQuery
    .input(z.object({ town: z.string() }))
    .query(async ({ input }) => {
      // Prices are updated by hand (no scheduled job), so requiring an
      // exact match to today's date would leave the page empty the moment
      // a day goes by without an admin update. Show whatever the most
      // recent priced day for this town actually is instead.
      const latest: any = await marketPrices.findOne({ town: input.town }).sort({ priceDate: -1 }).lean();
      if (!latest) return [];
      return omitMongo(
        await marketPrices
          .find({ town: input.town, priceDate: latest.priceDate })
          .sort({ cropName: 1 })
          .lean(),
      );
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
      return omitMongo(
        await marketPrices
          .find({ cropName: input.cropName, town: input.town })
          .sort({ priceDate: -1 })
          .limit(input.days)
          .lean(),
      );
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
    return omitMongo(await priceAlerts.find({ userId: ctx.user.id }).sort({ createdAt: -1 }).lean());
  }),

  deleteAlert: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await priceAlerts.deleteOne({ id: input.id, userId: ctx.user.id });
      return { success: true };
    }),
});
