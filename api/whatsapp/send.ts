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

// Plain SMS — for farmers on basic/feature phones who can't run WhatsApp.
// Uses Africa's Talking, not Twilio: standard Twilio phone numbers cannot
// send SMS to Kenya at all (long codes are unsupported there; the only
// permitted sender type, alphanumeric IDs, explicitly excludes P2P/OTP
// messages). Africa's Talking has direct Safaricom/Airtel relationships
// and is built for exactly this.
export async function sendSms(to: string, text: string): Promise<void> {
  const at = env.africastalking;
  try {
    if (at.username && at.apiKey) {
      const base = at.env === "production"
        ? "https://api.africastalking.com"
        : "https://api.sandbox.africastalking.com";

      const form = new URLSearchParams({ username: at.username, to, message: text });
      if (at.senderId) form.set("from", at.senderId);

      const res = await fetch(`${base}/version1/messaging`, {
        method: "POST",
        headers: {
          apiKey: at.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const data: any = await res.json().catch(() => null);
      const recipient = data?.SMSMessageData?.Recipients?.[0];
      if (!res.ok || !recipient || recipient.status !== "Success") {
        console.error("[sms send error]", JSON.stringify(data ?? { httpStatus: res.status }));
      }
    } else {
      console.log(`[sms:simulated → ${to}] ${text}`);
    }
  } catch (err) {
    console.error("[sms send error]", err);
  }
}
