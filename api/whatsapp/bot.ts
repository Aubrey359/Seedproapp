// WhatsApp conversation state machine for Shamba Sokoni.
// Stateless per call: loads the farmer (by phone) + their session from MongoDB,
// processes one message, persists the new state, and returns the reply text.
import {
  users,
  listings,
  marketPrices,
  advisoryMessages,
  botSessions,
  crops,
  nextSeq,
} from "@db/schema";

function titleCase(s: string): string {
  return s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function numIn(s: string): number {
  const m = s.replace(/[, ]/g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
function unitIn(s: string): string {
  if (/crate/i.test(s)) return "crate";
  if (/bag/i.test(s)) return "bag";
  if (/bunch/i.test(s)) return "bunch";
  return "kg";
}
function plural(n: number, unit: string): string {
  return n + " " + unit + (n > 1 && unit !== "kg" ? "s" : "");
}

async function logMsg(userId: number, direction: "incoming" | "outgoing", content: string) {
  // Convention matches the admin tab: "outgoing" = farmer's message, "incoming" = bot reply.
  await advisoryMessages.create({
    id: await nextSeq("advisory_messages"),
    userId,
    direction,
    content,
    messageType: "text",
  });
}

function menu(user: any): string {
  const hi = user?.name ? `, ${user.name}` : "";
  return (
    `👋 Welcome to Shamba Sokoni${hi}!\n\nReply with:\n` +
    `• *SELL* — list produce for sale\n` +
    `• *PRICES* — today's market prices\n` +
    `• *MY LISTINGS* — your active listings\n` +
    `• *HELP* — show this menu`
  );
}

async function pricesReply(msg: string): Promise<string> {
  const crop = msg.replace(/^price[s]?/i, "").trim();
  if (crop) {
    const rows = await marketPrices.find({ cropName: new RegExp(crop, "i") }).limit(6).lean();
    if (!rows.length) return `No prices found for "${crop}". Reply PRICES for a summary.`;
    return (
      `📈 ${(rows[0] as any).cropName} prices (KES/kg):\n` +
      rows.map((r: any) => `• ${r.town}: ${r.wholesalePrice} wholesale · ${r.retailPrice} retail`).join("\n")
    );
  }
  const rows = await marketPrices.find({ town: "Nairobi" }).limit(10).lean();
  if (!rows.length) return "Market prices are not available yet.";
  return (
    `📈 Today in Nairobi (KES/kg wholesale):\n` +
    rows.map((r: any) => `• ${r.cropName}: ${r.wholesalePrice}`).join("\n") +
    `\n\nReply *PRICES <crop>* for one crop, e.g. PRICES TOMATO.`
  );
}

async function myListingsReply(user: any): Promise<string> {
  const rows = await listings.find({ farmerId: user.id }).sort({ createdAt: -1 }).limit(10).lean();
  if (!rows.length) return "You have no listings yet. Reply *SELL* to create one.";
  return (
    "🌾 Your listings:\n" +
    rows
      .map((l: any) => `• #${l.id} ${l.cropName} — ${plural(l.quantity, l.quantityUnit || "kg")} @ KES ${l.expectedPrice} (${l.status})`)
      .join("\n")
  );
}

async function setSession(phone: string, step: string, draft: any) {
  await botSessions.updateOne({ phone }, { $set: { step, draft } });
}

async function route(user: any, session: any, msg: string): Promise<string> {
  const lower = msg.toLowerCase().trim();
  const step = session.step || "idle";
  const draft = session.draft || {};

  if (lower === "cancel" || lower === "stop") {
    await setSession(session.phone, "idle", {});
    return "Cancelled. Reply *SELL* to list produce, *PRICES* for prices, or *HELP*.";
  }

  // ── Sell flow ──
  if (step === "ask_crop") {
    draft.cropName = titleCase(msg);
    await setSession(session.phone, "ask_qty", draft);
    return `Great — selling *${draft.cropName}*. How much? (e.g. 50 crates, or 200 kg)`;
  }
  if (step === "ask_qty") {
    const n = numIn(msg);
    if (!n) return "Please send a number, e.g. *50 crates* or *200 kg*.";
    draft.quantity = n;
    draft.quantityUnit = unitIn(msg);
    await setSession(session.phone, "ask_location", draft);
    return `Got it — ${plural(n, draft.quantityUnit)}. Where are you? (county or town, e.g. Kandara)`;
  }
  if (step === "ask_location") {
    draft.location = titleCase(msg);
    await setSession(session.phone, "ask_price", draft);
    return `Location: ${draft.location}. Price per ${draft.quantityUnit} in KES? (e.g. 1800)`;
  }
  if (step === "ask_price") {
    const p = numIn(msg);
    if (!p) return "Please send a price in KES, e.g. *1800*.";
    draft.expectedPrice = p;
    await setSession(session.phone, "confirm", draft);
    return (
      `Please confirm your listing:\n\n` +
      `📦 ${plural(draft.quantity, draft.quantityUnit)} of *${draft.cropName}*\n` +
      `📍 ${draft.location}\n` +
      `💰 KES ${p.toLocaleString()} per ${draft.quantityUnit}\n\n` +
      `Reply *YES* to publish, or *CANCEL* to discard.`
    );
  }
  if (step === "confirm") {
    if (lower === "yes" || lower === "y") {
      const crop: any = await crops.findOne({ name: draft.cropName }).lean();
      const id = await nextSeq("listings");
      await listings.create({
        id,
        farmerId: user.id,
        cropId: crop?.id ?? 1,
        cropName: draft.cropName,
        quantity: draft.quantity,
        quantityUnit: draft.quantityUnit,
        location: draft.location,
        expectedPrice: draft.expectedPrice,
        status: "active",
      });
      await setSession(session.phone, "idle", {});
      return (
        `✅ Listed! Your *${draft.cropName}* is now live on Shamba Sokoni (ref #${id}). ` +
        `Buyers across Kenya can see it.\n\nReply *MY LISTINGS* to view, or *SELL* to add another.`
      );
    }
    return "Reply *YES* to publish, or *CANCEL* to discard.";
  }

  // ── Idle: top-level commands ──
  if (lower.startsWith("sell")) {
    const rest = msg.replace(/^sell/i, "").trim();
    if (rest) {
      const d = { cropName: titleCase(rest) };
      await setSession(session.phone, "ask_qty", d);
      return `Great — selling *${d.cropName}*. How much? (e.g. 50 crates, or 200 kg)`;
    }
    await setSession(session.phone, "ask_crop", {});
    return "What are you selling? (e.g. Tomatoes, Maize, Avocado)";
  }
  if (lower.startsWith("price")) return pricesReply(msg);
  if (lower.includes("my listing") || lower === "listings") return myListingsReply(user);
  if (["help", "menu", "hi", "hello", "start", "habari"].indexOf(lower) >= 0) return menu(user);

  return menu(user);
}

// Entry point: process one inbound message from `phone`, return the reply text.
export async function handleMessage(phone: string, text: string): Promise<string> {
  const msg = (text || "").trim();

  // Find or create the farmer by phone (the WhatsApp number is their identity).
  let user: any = await users.findOne({ phone }).lean();
  if (!user) {
    const id = await nextSeq("users");
    const created = await users.create({ id, unionId: "wa_" + phone, phone, userType: "farmer" });
    user = created.toObject();
  }

  let session: any = await botSessions.findOne({ phone });
  if (!session) session = await botSessions.create({ phone, userId: user.id, step: "idle", draft: {} });

  await logMsg(user.id, "outgoing", msg); // farmer's inbound message
  const reply = await route(user, session, msg);
  await logMsg(user.id, "incoming", reply); // bot's reply
  return reply;
}
