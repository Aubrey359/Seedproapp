// WhatsApp webhook + local simulator.
import { Hono } from "hono";
import { env } from "./lib/env";
import { connectDb } from "./lib/db";
import { handleMessage } from "./whatsapp/bot";
import { sendWhatsApp } from "./whatsapp/send";

const wa = new Hono();

// ── Meta verification handshake (GET) ────────────────────────
wa.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  if (mode === "subscribe" && token === env.whatsapp.verifyToken) {
    return c.text(challenge ?? "");
  }
  return c.text("Forbidden", 403);
});

// ── Incoming messages (POST) ─────────────────────────────────
wa.post("/webhook", async (c) => {
  try {
    await connectDb();
    const body: any = await c.req.json().catch(() => ({}));

    // Meta WhatsApp Cloud API payload shape.
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const messages: any[] = value?.messages || [];

    for (const m of messages) {
      const from: string | undefined = m.from;
      const text: string = m.text?.body || m.button?.text || m.interactive?.list_reply?.title || "";
      if (from) {
        const reply = await handleMessage(from, text);
        await sendWhatsApp(from, reply);
      }
    }
    return c.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp webhook]", err);
    return c.json({ ok: true }); // always 200 so the provider doesn't retry-storm
  }
});

// ── Local simulator (admin-key gated) ────────────────────────
// Test the full conversation without a real WhatsApp number.
wa.post("/simulate", async (c) => {
  const key = c.req.header("x-admin-key") || c.req.query("key");
  if (key !== env.adminKey) return c.json({ error: "Unauthorized" }, 401);
  await connectDb();
  const { phone, text } = await c.req.json().catch(() => ({}));
  const reply = await handleMessage(String(phone || "254700000001"), String(text || ""));
  return c.json({ reply });
});

export default wa;
