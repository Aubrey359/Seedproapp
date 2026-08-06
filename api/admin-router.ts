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
  disputes,
  siteSettings,
  crops,
  cropGuides,
  spraySchedules,
  announcements,
  farmerPosts,
  nextSeq,
  omitMongo,
} from "@db/schema";

const SETTINGS_FIELDS = [
  "heroHeadline", "heroSubtext", "whatsappNumber",
  "instagramUrl", "xUrl", "facebookUrl",
  "footerTagline", "footerAddress",
] as const;

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
      msgCount, convoUsers, openDisputes,
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
      disputes.countDocuments({ status: "open" }),
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
        openDisputes,
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

admin.post(
  "/users/premium",
  guard(async (c) => {
    const { id, premium } = await c.req.json();
    const set: any = { premium: !!premium };
    if (premium) set.verified = true; // premium approval also confers verified status
    await users.updateOne({ id: Number(id) }, { $set: set });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// Editable profile fields only — phone is deliberately excluded since it
// doubles as login identity (unionId is derived from it); changing it here
// would desync WhatsApp/OTP sign-in from the user record.
admin.post(
  "/users/details",
  guard(async (c) => {
    const { id, name, location, ward } = await c.req.json();
    const set: any = {};
    if (name != null) set.name = String(name).trim() || null;
    if (location != null) set.location = String(location).trim() || null;
    if (ward != null) set.ward = String(ward).trim() || null;
    await users.updateOne({ id: Number(id) }, { $set: set });
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

// ── Disputes ─────────────────────────────────────────────────
admin.get(
  "/disputes",
  guard(async (c) => {
    const rows = omitMongo(await disputes.find({}).sort({ createdAt: -1 }).limit(300).lean());
    const ids = [...new Set(rows.map((r: any) => r.raisedBy))];
    const people = await users.find({ id: { $in: ids } }).lean();
    const byId = new Map(people.map((p: any) => [p.id, p]));
    return c.json({
      dbConnected: true,
      disputes: rows.map((r: any) => ({
        ...r,
        raisedByName: byId.get(r.raisedBy)?.name ?? null,
        raisedByPhone: byId.get(r.raisedBy)?.phone ?? null,
      })),
    });
  }),
);

admin.post(
  "/disputes/status",
  guard(async (c) => {
    const { id, status, resolution } = await c.req.json();
    const set: any = { status };
    if (resolution != null) set.resolution = resolution;
    await disputes.updateOne({ id: Number(id) }, { $set: set });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── Site content (hero copy, social links, footer text) ──────
admin.get(
  "/settings",
  guard(async (c) => {
    const s: any = await siteSettings.findOne({ key: "main" }).lean();
    const settings: any = {};
    for (const f of SETTINGS_FIELDS) settings[f] = s?.[f] ?? "";
    return c.json({ dbConnected: true, settings });
  }),
);

admin.post(
  "/settings",
  guard(async (c) => {
    const body = await c.req.json();
    const set: any = {};
    for (const f of SETTINGS_FIELDS) {
      if (body[f] != null) set[f] = String(body[f]).trim();
    }
    await siteSettings.updateOne({ key: "main" }, { $set: set }, { upsert: true });
    return c.json({ dbConnected: true, ok: true });
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

// ── My Farm: crop guides + task schedules (only 4 of 12 crops are
// seeded with real content — this is how the team extends coverage to
// the rest without a code deploy) ────────────────────────────
admin.get(
  "/crop-guides",
  guard(async (c) => {
    const [cropRows, guideRows, scheduleRows] = await Promise.all([
      crops.find({}).sort({ name: 1 }).lean(),
      cropGuides.find({}).sort({ cropId: 1, stageOrder: 1 }).lean(),
      spraySchedules.find({}).sort({ cropId: 1, dayFrom: 1 }).lean(),
    ]);
    return c.json({
      dbConnected: true,
      crops: omitMongo(cropRows),
      guides: omitMongo(guideRows),
      schedules: omitMongo(scheduleRows),
    });
  }),
);

admin.post(
  "/crop-guides/save",
  guard(async (c) => {
    const body = await c.req.json();
    const toLines = (s: any) => String(s ?? "").split("\n").map((x: string) => x.trim()).filter(Boolean);
    const set = {
      cropId: Number(body.cropId),
      stage: String(body.stage ?? "").trim(),
      stageOrder: Number(body.stageOrder),
      dayFrom: Number(body.dayFrom),
      dayTo: body.dayTo === "" || body.dayTo == null ? undefined : Number(body.dayTo),
      title: String(body.title ?? "").trim(),
      description: String(body.description ?? "").trim(),
      tasks: toLines(body.tasks),
      tips: toLines(body.tips),
      warnings: toLines(body.warnings),
    };
    if (body.id) {
      await cropGuides.updateOne({ id: Number(body.id) }, { $set: set });
    } else {
      const id = await nextSeq("crop_guides");
      await cropGuides.create({ id, ...set });
    }
    return c.json({ dbConnected: true, ok: true });
  }),
);

admin.post(
  "/crop-guides/delete",
  guard(async (c) => {
    const { id } = await c.req.json();
    await cropGuides.deleteOne({ id: Number(id) });
    return c.json({ dbConnected: true, ok: true });
  }),
);

admin.post(
  "/spray-schedules/save",
  guard(async (c) => {
    const body = await c.req.json();
    const set = {
      cropId: Number(body.cropId),
      stage: String(body.stage ?? "").trim(),
      dayFrom: Number(body.dayFrom),
      dayTo: Number(body.dayTo),
      activityType: body.activityType,
      productName: body.productName ? String(body.productName).trim() : undefined,
      dosage: body.dosage ? String(body.dosage).trim() : undefined,
      // Structured rate for the fertilizer calculator — distinct from the
      // free-text dosage above. Left unset (not zero) when blank, since
      // "no rate" and "zero kg/acre" mean very different things here.
      ratePerAcreKg: body.ratePerAcreKg === "" || body.ratePerAcreKg == null ? undefined : Number(body.ratePerAcreKg),
      instructions: String(body.instructions ?? "").trim(),
    };
    if (body.id) {
      await spraySchedules.updateOne({ id: Number(body.id) }, { $set: set });
    } else {
      const id = await nextSeq("spray_schedules");
      await spraySchedules.create({ id, ...set });
    }
    return c.json({ dbConnected: true, ok: true });
  }),
);

admin.post(
  "/spray-schedules/delete",
  guard(async (c) => {
    const { id } = await c.req.json();
    await spraySchedules.deleteOne({ id: Number(id) });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// ── Blog page: fertilizer ads + agricultural events ───────────
// The admin view intentionally shows everything (including inactive/past
// entries) so they can be re-activated or cleaned up — only the public
// announcements.list query hides inactive entries and past events.
admin.get(
  "/announcements",
  guard(async (c) => {
    const rows = await announcements.find({}).sort({ createdAt: -1 }).lean();
    return c.json({ dbConnected: true, announcements: omitMongo(rows) });
  }),
);

admin.post(
  "/announcements/save",
  guard(async (c) => {
    const body = await c.req.json();
    const set: any = {
      type: body.type === "event" ? "event" : "ad",
      title: String(body.title ?? "").trim(),
      description: String(body.description ?? "").trim(),
      imageUrl: body.imageUrl ? String(body.imageUrl).trim() : undefined,
      sponsorName: body.sponsorName ? String(body.sponsorName).trim() : undefined,
      ctaLabel: body.ctaLabel ? String(body.ctaLabel).trim() : undefined,
      ctaUrl: body.ctaUrl ? String(body.ctaUrl).trim() : undefined,
      eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
      eventLocation: body.eventLocation ? String(body.eventLocation).trim() : undefined,
      active: body.active !== "false" && body.active !== false,
    };
    if (body.id) {
      await announcements.updateOne({ id: Number(body.id) }, { $set: set });
    } else {
      const id = await nextSeq("announcements");
      await announcements.create({ id, ...set });
    }
    return c.json({ dbConnected: true, ok: true });
  }),
);

admin.post(
  "/announcements/delete",
  guard(async (c) => {
    const { id } = await c.req.json();
    await announcements.deleteOne({ id: Number(id) });
    return c.json({ dbConnected: true, ok: true });
  }),
);

// Farmer Updates feed — moderation only (view + delete). Posts are
// farmer-authored, not admin-authored, so there's no save/edit endpoint.
admin.get(
  "/farmer-posts",
  guard(async (c) => {
    const rows = await farmerPosts.find({}).sort({ createdAt: -1 }).limit(200).lean();
    const farmerIds = [...new Set(rows.map((r: any) => r.farmerId))];
    const farmerRows = farmerIds.length ? await users.find({ id: { $in: farmerIds } }).lean() : [];
    const farmerMap = new Map(farmerRows.map((f: any) => [f.id, f]));
    const enriched = rows.map((r: any) => ({ ...r, farmerName: farmerMap.get(r.farmerId)?.name ?? "Farmer" }));
    return c.json({ dbConnected: true, posts: omitMongo(enriched) });
  }),
);

admin.post(
  "/farmer-posts/delete",
  guard(async (c) => {
    const { id } = await c.req.json();
    await farmerPosts.deleteOne({ id: Number(id) });
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
