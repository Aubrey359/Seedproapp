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
import whatsappRouter from "./whatsapp-router";
import { sendWhatsApp } from "./whatsapp/send";

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

    // Fetch first so we have the payer's phone number for the WhatsApp
    // alert below regardless of which branch runs.
    const payment: any = await mpesaPayments
      .findOne({ checkoutRequestId: CheckoutRequestID })
      .lean();

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
      if (payment?.orderId) {
        await orders.updateOne({ id: payment.orderId }, { $set: { status: "confirmed" } });
      }

      if (payment?.phone) {
        const amount = payment.amount ? `KES ${Number(payment.amount).toLocaleString()}` : "your payment";
        sendWhatsApp(
          payment.phone,
          `✅ Payment received!\n\n${amount} confirmed${receipt ? ` (M-Pesa receipt ${receipt})` : ""}. Thank you for using Shamba Pay.`,
        ).catch(() => {});
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

      if (payment?.phone) {
        const isCancelled = ResultCode === 1032;
        sendWhatsApp(
          payment.phone,
          isCancelled
            ? `⚠️ M-Pesa payment cancelled. Reply to try again when you're ready.`
            : `❌ M-Pesa payment failed. ${ResultDesc || "Please try again."}`,
        ).catch(() => {});
      }
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

// WhatsApp bot webhook + simulator
app.route("/api/whatsapp", whatsappRouter);

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// Start the standalone server whenever we're actually running outside Vite's
// dev-server plugin. NODE_ENV=production is one signal, but relying on it
// alone is fragile — it silently does nothing if a host forgets to set it.
// PORT is injected by Render (and most PaaS hosts) unconditionally, so treat
// its presence as an equally valid "start listening" signal.
if (env.isProduction || process.env.PORT) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
