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

  // M-Pesa Daraja
  mpesa: {
    consumerKey:    optional("MPESA_CONSUMER_KEY"),
    consumerSecret: optional("MPESA_CONSUMER_SECRET"),
    shortcode:      optional("MPESA_SHORTCODE")    || "174379",
    passkey:        optional("MPESA_PASSKEY")      || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
    callbackUrl:    optional("MPESA_CALLBACK_URL") || "https://seedpro.ke/api/mpesa/callback",
    env:            (optional("MPESA_ENV") || "sandbox") as "sandbox" | "production",
  },
};
