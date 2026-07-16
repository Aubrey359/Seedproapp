import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { paypalPayments, nextSeq } from "@db/schema";
import { createOrder } from "./lib/paypal";
import { env } from "./lib/env";

export const paypalRouter = createRouter({
  // ── Create order, get the buyer's approval redirect URL ────────
  createOrder: publicQuery
    .input(z.object({ amountKes: z.number().positive(), orderIds: z.array(z.number()).optional() }))
    .mutation(async ({ input }) => {
      const paymentId = await nextSeq("paypal_payments");
      const amountUsd = Math.round((input.amountKes / env.paypal.kesToUsdRate) * 100) / 100;

      const result = await createOrder({
        amountUsd,
        referenceId: `SS-${paymentId}`,
        returnUrl: `${env.paypal.returnUrl}?paymentId=${paymentId}`,
        cancelUrl: `${env.paypal.cancelUrl}?paymentId=${paymentId}`,
      });

      await paypalPayments.create({
        id: paymentId,
        orderIds: input.orderIds ?? [],
        paypalOrderId: result.orderId,
        amountKes: input.amountKes,
        amountUsd,
        status: "pending",
      });

      return { approveUrl: result.approveUrl, paymentId, amountUsd };
    }),

  // ── Poll for the checkout modal (buyer may still be on PayPal's page) ──
  getById: publicQuery
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ input }) => {
      return await paypalPayments.findOne({ id: input.paymentId }).lean();
    }),
});
