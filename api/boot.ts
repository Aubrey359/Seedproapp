import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { mpesaPayments, orders } from "@db/schema";
import { connectDb } from "./lib/db";
import adminRouter from "./admin-router";

// Connect to MongoDB and seed on first run (non-blocking for the frontend)
connectDb();

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
    await connectDb();

    if (ResultCode === 0) {
      // Successful payment — extract receipt & transaction date
      const items: any[] = CallbackMetadata?.Item ?? [];
      const get = (name: string) => items.find((i: any) => i.Name === name)?.Value;

      const receipt = String(get("MpesaReceiptNumber") ?? "");
      const txDate  = String(get("TransactionDate")    ?? "");

      await mpesaPayments.updateOne(
        { checkoutRequestId: CheckoutRequestID },
        {
          $set: {
            status: "completed",
            mpesaReceiptNumber: receipt,
            transactionDate: txDate,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            rawCallback: body,
          },
        },
      );

      // Mark associated order as confirmed
      const payment: any = await mpesaPayments
        .findOne({ checkoutRequestId: CheckoutRequestID })
        .lean();

      if (payment?.orderId) {
        await orders.updateOne({ id: payment.orderId }, { $set: { status: "confirmed" } });
      }
    } else {
      await mpesaPayments.updateOne(
        { checkoutRequestId: CheckoutRequestID },
        {
          $set: {
            status: ResultCode === 1032 ? "cancelled" : "failed",
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            rawCallback: body,
          },
        },
      );
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

// Admin dashboard API (key-gated REST)
app.route("/api/admin", adminRouter);

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
