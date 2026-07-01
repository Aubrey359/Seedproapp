// Admin dashboard REST API (separate from the tRPC app).
// Every route is gated by the x-admin-key header (env.adminKey).
import { Hono } from "hono";
import { env } from "./lib/env";
import { connectDb } from "./lib/db";
import {
  mongoose,
  users,
  listings,
  orders,
  mpesaPayments,
  marketPrices,
  advisoryMessages,
  omitMongo,
} from "@db/schema";

const admin = new Hono();

// ── Auth + DB readiness ──────────────────────────────────────
admin.use("*", async (c, next) => {
  const key = c.req.header("x-admin-key") || c.req.query("key");
  if (!key || key !== env.adminKey) {
    return c.json({ error: "Unauthorized — invalid admin key" }, 401);
  }
  await connectDb();
  await next();
});

const dbReady = () => mongoose.connection?.readyState === 1;
// Wrap a handler so a missing DB returns a clean flag instead of a 500.
function guard(handler: (c: any) => Promise<Response>) {
  return async (c: any) => {
    if (!dbReady()) return c.json({ dbConnected: false });
    try {
      return await handler(c);
    } catch (err: any) {
      return c.json({ dbConnected: true, error: String(err?.message ?? err) }, 500);
    }
  };
}

// ── Overview stats ───────────────────────────────────────────
admin.get(
  "/overview",
  guard(async (c) => {
    const [
      farmers, buyers, verified,
      activeListings, totalListings,
      pendingOrders, totalOrders,
      paidAgg, pendingPayments,
      msgCount, convoUsers,
    ] = await Promise.all([
      users.countDocuments({ userType: "farmer" }),
      users.countDocuments({ userType: "buyer" }),
      users.countDocuments({ verified: true }),
      listings.countDocuments({ status: "active" }),
      listings.countDocuments({}),
      orders.countDocuments({ status: "pending" }),
      orders.countDocuments({}),
      mpesaPayments.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, sum: { $sum: "$amount" }, n: { $sum: 1 } } },
      ]),
      mpesaPayments.countDocuments({ status: "pending" }),
      advisoryMessages.countDocuments({}),
      advisoryMessages.distinct("userId"),
    ]);
    return c.json({
      dbConnected: true,
      stats: {
        farmers, buyers, verified,
        activeListings, totalListings,
        pendingOrders, totalOrders,
        revenue: paidAgg[0]?.sum ?? 0,
        completedPayments: paidAgg[0]?.n ?? 0,
        pendingPayments,
        messages: msgCount,
        conversations: convoUsers.length,
      },
    });
  }),
);

// ── Users / farmers ──────────────────────────────────────────
admin.get(
  "/users",
  guard(async (c) => {
    const rows = await users.find({}).sort({ createdAt: -1 }).limit(300).lean();
    return c.json({ dbConnected: true, users: omitMongo(rows) });
  }),
);

admin.post(
  "/users/verify",
  guard(async (c) => {
    const { id, verified } = await c.req.json();
    await users.updateOne({ id: Number(id) }, { $set: { verified: !!verified } });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── Listings ─────────────────────────────────────────────────
admin.get(
  "/listings",
  guard(async (c) => {
    const rows = omitMongo(await listings.find({}).sort({ createdAt: -1 }).limit(300).lean());
    const ids = [...new Set(rows.map((r: any) => r.farmerId))];
    const farmers = await users.find({ id: { $in: ids } }).lean();
    const byId = new Map(farmers.map((f: any) => [f.id, f]));
    return c.json({
      dbConnected: true,
      listings: rows.map((r: any) => ({ ...r, farmerName: byId.get(r.farmerId)?.name ?? null })),
    });
  }),
);

admin.post(
  "/listings/status",
  guard(async (c) => {
    const { id, status } = await c.req.json();
    await listings.updateOne({ id: Number(id) }, { $set: { status } });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── Orders ───────────────────────────────────────────────────
admin.get(
  "/orders",
  guard(async (c) => {
    const rows = await orders.find({}).sort({ createdAt: -1 }).limit(300).lean();
    return c.json({ dbConnected: true, orders: omitMongo(rows) });
  }),
);

admin.post(
  "/orders/status",
  guard(async (c) => {
    const { id, status } = await c.req.json();
    await orders.updateOne({ id: Number(id) }, { $set: { status } });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── Payments ─────────────────────────────────────────────────
admin.get(
  "/payments",
  guard(async (c) => {
    const rows = await mpesaPayments.find({}).sort({ createdAt: -1 }).limit(300).lean();
    return c.json({ dbConnected: true, payments: omitMongo(rows) });
  }),
);

// ── Market prices ────────────────────────────────────────────
admin.get(
  "/prices",
  guard(async (c) => {
    const today = new Date().toISOString().split("T")[0];
    let rows = await marketPrices.find({ priceDate: today }).sort({ town: 1, cropName: 1 }).lean();
    if (rows.length === 0) rows = await marketPrices.find({}).sort({ createdAt: -1 }).limit(120).lean();
    return c.json({ dbConnected: true, prices: omitMongo(rows) });
  }),
);

admin.post(
  "/prices",
  guard(async (c) => {
    const { id, wholesalePrice, retailPrice, trend, trendPercent } = await c.req.json();
    const set: any = {};
    if (wholesalePrice != null) set.wholesalePrice = Number(wholesalePrice);
    if (retailPrice != null) set.retailPrice = Number(retailPrice);
    if (trend != null) set.trend = trend;
    if (trendPercent != null) set.trendPercent = Number(trendPercent);
    await marketPrices.updateOne({ id: Number(id) }, { $set: set });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── WhatsApp bot: conversations + status ─────────────────────
admin.get(
  "/whatsapp",
  guard(async (c) => {
    // Group advisory messages (the WhatsApp-style chat model) by user.
    const convos = await advisoryMessages.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          messages: { $sum: 1 },
          lastMessage: { $first: "$content" },
          lastAt: { $first: "$createdAt" },
        },
      },
      { $sort: { lastAt: -1 } },
      { $limit: 100 },
    ]);
    const ids = convos.map((x: any) => x._id);
    const people = await users.find({ id: { $in: ids } }).lean();
    const byId = new Map(people.map((p: any) => [p.id, p]));
    return c.json({
      dbConnected: true,
      bot: {
        // The WhatsApp Business API channel is not wired yet — surfaced so the
        // dashboard shows status. Set WHATSAPP_* env vars when the bot is built.
        provider: env_get("WHATSAPP_PROVIDER") || null,
        connected: !!env_get("WHATSAPP_TOKEN"),
        number: env_get("WHATSAPP_NUMBER") || null,
      },
      conversations: convos.map((x: any) => ({
        userId: x._id,
        name: byId.get(x._id)?.name ?? null,
        phone: byId.get(x._id)?.phone ?? null,
        messages: x.messages,
        lastMessage: x.lastMessage,
        lastAt: x.lastAt,
      })),
    });
  }),
);

admin.get(
  "/whatsapp/messages",
  guard(async (c) => {
    const userId = Number(c.req.query("userId"));
    const rows = await advisoryMessages
      .find({ userId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    return c.json({ dbConnected: true, messages: omitMongo(rows) });
  }),
);

function env_get(name: string): string {
  return process.env[name] ?? "";
}

export default admin;
