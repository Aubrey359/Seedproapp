import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { pesapalPayments, nextSeq } from "@db/schema";
import { submitOrder } from "./lib/pesapal";
import { env } from "./lib/env";

export const pesapalRouter = createRouter({
  // ── Submit order, get the buyer's payment-page redirect URL ────
  submitOrder: publicQuery
    .input(
      z.object({
        amount: z.number().positive(),
        orderIds: z.array(z.number()).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(9).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!input.email && !input.phone) {
        throw new Error("Pesapal requires an email address or phone number");
      }
      const paymentId = await nextSeq("pesapal_payments");
      const merchantReference = `SS-${paymentId}`;

      const result = await submitOrder({
        merchantReference,
        amount: input.amount,
        description: "Shamba Sokoni farm produce order",
        callbackUrl: env.pesapal.callbackUrl,
        email: input.email,
        phone: input.phone,
      });

      await pesapalPayments.create({
        id: paymentId,
        orderIds: input.orderIds ?? [],
        orderTrackingId: result.orderTrackingId,
        merchantReference,
        amount: input.amount,
        status: "pending",
      });

      return { redirectUrl: result.redirectUrl, paymentId };
    }),

  // ── Poll for the checkout modal ─────────────────────────────────
  getById: publicQuery
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ input }) => {
      return await pesapalPayments.findOne({ id: input.paymentId }).lean();
    }),
});
