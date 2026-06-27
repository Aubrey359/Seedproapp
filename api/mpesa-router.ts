import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { mpesaPayments, orders } from "@db/schema";
import { eq } from "drizzle-orm";
import { stkPush, stkQuery, normalizePhone } from "./lib/mpesa";

export const mpesaRouter = createRouter({

  // ── Initiate STK Push ────────────────────────────────────────
  stkPush: publicQuery
    .input(z.object({
      phone:      z.string().min(9, "Invalid phone number"),
      amount:     z.number().positive("Amount must be positive"),
      orderId:    z.number().optional(),
      accountRef: z.string().default("SeedPro"),
      description:z.string().default("Farm Produce Payment"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const result = await stkPush({
        phone:       input.phone,
        amount:      input.amount,
        accountRef:  input.accountRef,
        description: input.description,
      });

      // Persist payment record
      const inserted = db.insert(mpesaPayments).values({
        orderId:           input.orderId ?? null,
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        phone:             normalizePhone(input.phone),
        amount:            input.amount,
        accountRef:        input.accountRef,
        status:            "pending",
      }).run();

      return {
        checkoutRequestId: result.checkoutRequestId,
        customerMessage:   result.customerMessage,
        paymentId:         Number(inserted.lastInsertRowid),
      };
    }),

  // ── Query Payment Status ─────────────────────────────────────
  checkStatus: publicQuery
    .input(z.object({ checkoutRequestId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      // First check our own DB (callback may have arrived already)
      const [payment] = db
        .select()
        .from(mpesaPayments)
        .where(eq(mpesaPayments.checkoutRequestId, input.checkoutRequestId))
        .all();

      if (payment?.status === "completed") {
        return { status: "completed", receipt: payment.mpesaReceiptNumber };
      }
      if (payment?.status === "failed" || payment?.status === "cancelled") {
        return { status: payment.status, receipt: null };
      }

      // Query Daraja for live status
      try {
        const query = await stkQuery(input.checkoutRequestId);
        if (query.resultCode === "0") return { status: "completed", receipt: null };
        if (query.resultCode === "1032") return { status: "cancelled", receipt: null };
        return { status: "pending", receipt: null };
      } catch {
        return { status: "pending", receipt: null };
      }
    }),

  // ── Get payment by order ─────────────────────────────────────
  getByOrder: publicQuery
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [payment] = db
        .select()
        .from(mpesaPayments)
        .where(eq(mpesaPayments.orderId, input.orderId))
        .all();
      return payment ?? null;
    }),
});
