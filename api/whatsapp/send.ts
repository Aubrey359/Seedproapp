import { env } from "../lib/env";

// Send a WhatsApp text reply via the configured provider.
// With no provider set, runs in simulator mode (logs only) so the bot is
// fully testable before a real WhatsApp number is connected.
export async function sendWhatsApp(to: string, text: string): Promise<void> {
  const wa = env.whatsapp;
  try {
    if (wa.provider === "meta" && wa.token && wa.phoneId) {
      await fetch(`https://graph.facebook.com/v21.0/${wa.phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${wa.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
    } else if (wa.provider === "twilio" && wa.token && wa.number) {
      const [sid, auth] = wa.token.split(":");
      const form = new URLSearchParams({
        From: `whatsapp:${wa.number}`,
        To: `whatsapp:${to}`,
        Body: text,
      });
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
    } else {
      // Simulator mode — no provider configured yet.
      console.log(`[whatsapp:simulated → ${to}] ${text}`);
    }
  } catch (err) {
    console.error("[whatsapp send error]", err);
  }
}
