import { createRequire } from "module";

// Load .env relative to process.cwd() (the project root)
const require = createRequire(process.cwd() + "/package.json");
const dotenv  = require("dotenv");
dotenv.config(); // reads .env from cwd by default

function optional(name: string): string {
  return process.env[name] ?? "";
}

export const env = {
  appId:        optional("APP_ID")     || "seedpro-kenya",
  appSecret:    optional("APP_SECRET") || "seedpro-dev-secret",
  isProduction: process.env.NODE_ENV === "production",
  kimiAuthUrl:  optional("KIMI_AUTH_URL"),
  kimiOpenUrl:  optional("KIMI_OPEN_URL"),
  ownerUnionId: optional("OWNER_UNION_ID"),

  // MongoDB Atlas connection string (mongodb+srv://…)
  mongoUri:     optional("MONGODB_URI"),

  // Admin dashboard access key (set ADMIN_KEY in .env for production)
  adminKey:     optional("ADMIN_KEY") || "shamba-admin-2026",

  // WhatsApp bot — leave provider empty to run in local-simulator mode
  whatsapp: {
    provider:    optional("WHATSAPP_PROVIDER"),                 // "meta" | "twilio" | ""
    token:       optional("WHATSAPP_TOKEN"),                    // Meta access token, or Twilio "SID:AUTHTOKEN"
    phoneId:     optional("WHATSAPP_PHONE_ID"),                 // Meta phone number id
    number:      optional("WHATSAPP_NUMBER"),                   // sender number (Twilio / display)
    verifyToken: optional("WHATSAPP_VERIFY_TOKEN") || "shamba-verify",
  },

  // SMS fallback for OTP — for farmers on basic phones without WhatsApp.
  // Token defaults to the same Twilio account as WhatsApp (SID:AUTHTOKEN),
  // but SMS_NUMBER must be set separately — a WhatsApp Sandbox number is
  // not a regular SMS sender.
  sms: {
    provider: optional("SMS_PROVIDER") || "twilio",
    token:    optional("SMS_TWILIO_TOKEN") || optional("WHATSAPP_TOKEN"),
    number:   optional("SMS_NUMBER"),
  },

  // M-Pesa Daraja
  mpesa: {
    consumerKey:    optional("MPESA_CONSUMER_KEY"),
    consumerSecret: optional("MPESA_CONSUMER_SECRET"),
    shortcode:      optional("MPESA_SHORTCODE")    || "174379",
    passkey:        optional("MPESA_PASSKEY")      || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
    callbackUrl:    optional("MPESA_CALLBACK_URL") || "https://seedpro.ke/api/mpesa/callback",
    env:            (optional("MPESA_ENV") || "sandbox") as "sandbox" | "production",
  },

  // PayPal (USD only — PayPal does not support KES as a currency)
  paypal: {
    clientId:     optional("PAYPAL_CLIENT_ID"),
    clientSecret: optional("PAYPAL_CLIENT_SECRET"),
    env:          (optional("PAYPAL_ENV") || "sandbox") as "sandbox" | "production",
    returnUrl:    optional("PAYPAL_RETURN_URL") || "https://mkulima-sokoni.onrender.com/api/paypal/return",
    cancelUrl:    optional("PAYPAL_CANCEL_URL") || "https://mkulima-sokoni.onrender.com/api/paypal/cancel",
    // Approximate — PayPal has no KES support, so cart totals are converted to USD.
    // Update periodically; this is not a live exchange-rate feed.
    kesToUsdRate: Number(optional("KES_TO_USD_RATE") || "129"),
  },

  // Pesapal (KES — aggregates M-Pesa, Airtel Money, and cards behind one API)
  pesapal: {
    consumerKey:    optional("PESAPAL_CONSUMER_KEY"),
    consumerSecret: optional("PESAPAL_CONSUMER_SECRET"),
    env:            (optional("PESAPAL_ENV") || "sandbox") as "sandbox" | "production",
    callbackUrl:    optional("PESAPAL_CALLBACK_URL") || "https://mkulima-sokoni.onrender.com/api/pesapal/return",
    ipnUrl:         optional("PESAPAL_IPN_URL")      || "https://mkulima-sokoni.onrender.com/api/pesapal/ipn",
  },
};
