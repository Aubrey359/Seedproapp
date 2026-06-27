import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { mpesaPayments, orders } from "@db/schema";
import { eq } from "drizzle-orm";
import { initDb } from "./lib/init-db";

// Initialise database tables and seed on first run
initDb();

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// ── M-Pesa Daraja callback webhook ───────────────────────────
app.post("/api/mpesa/callback", async (c) => {
  try {
    const body = await c.req.json() as any;
    const stk  = body?.Body?.stkCallback;
    if (!stk) return c.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stk;
    const db = getDb();

    if (ResultCode === 0) {
      // Successful payment — extract receipt & transaction date
      const items: any[] = CallbackMetadata?.Item ?? [];
      const get = (name: string) => items.find((i: any) => i.Name === name)?.Value;

      const receipt   = String(get("MpesaReceiptNumber") ?? "");
      const txDate    = String(get("TransactionDate")    ?? "");
      const amount    = Number(get("Amount")             ?? 0);
      const phone     = String(get("PhoneNumber")        ?? "");

      db.update(mpesaPayments)
        .set({
          status:             "completed",
          mpesaReceiptNumber: receipt,
          transactionDate:    txDate,
          resultCode:         ResultCode,
          resultDesc:         ResultDesc,
          rawCallback:        body,
          updatedAt:          new Date().toISOString(),
        })
        .where(eq(mpesaPayments.checkoutRequestId, CheckoutRequestID))
        .run();

      // Mark associated order as confirmed
      const [payment] = db
        .select({ orderId: mpesaPayments.orderId })
        .from(mpesaPayments)
        .where(eq(mpesaPayments.checkoutRequestId, CheckoutRequestID))
        .all();

      if (payment?.orderId) {
        db.update(orders)
          .set({ status: "confirmed", updatedAt: new Date().toISOString() })
          .where(eq(orders.id, payment.orderId))
          .run();
      }
    } else {
      db.update(mpesaPayments)
        .set({
          status:     ResultCode === 1032 ? "cancelled" : "failed",
          resultCode: ResultCode,
          resultDesc: ResultDesc,
          rawCallback:body,
          updatedAt:  new Date().toISOString(),
        })
        .where(eq(mpesaPayments.checkoutRequestId, CheckoutRequestID))
        .run();
    }

    return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("M-Pesa callback error:", err);
    return c.json({ ResultCode: 0, ResultDesc: "Accepted" }); // always 200 to Daraja
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
