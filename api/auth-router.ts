import * as cookie from "hono/utils/cookie";
import { createHash } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { otpCodes, users, mpesaPayments, siteSettings, nextSeq } from "@db/schema";
import { findOrCreateFarmerByPhone } from "./lib/identity";
import { sendWhatsApp, sendSms } from "./whatsapp/send";
import { signSessionToken } from "./kimi/session";
import { stkPush, normalizePhone as normalizeMpesaPhone } from "./lib/mpesa";
import { polygonAcres } from "./lib/geo";

const OTP_TTL_MS = 5 * 60 * 1000;
// Matches the resend countdown shown in the sign-in UI — keep these in sync.
const OTP_RESEND_COOLDOWN_MS = 25 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Kenyan numbers arrive as 0712…, 254712…, or +254712… depending on where the
// form is used — normalize to +254… so a request/verify pair always matches
// and so it's a deliverable WhatsApp address.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+254")) return digits;
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  return digits.startsWith("+") ? digits : "+" + digits;
}

function setSessionCookie(ctx: { req: Request; resHeaders: Headers }, token: string, maxAgeSeconds: number) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: maxAgeSeconds,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  requestOtp: publicQuery
    .input(z.object({ phone: z.string().min(9), channel: z.enum(["whatsapp", "sms"]).default("whatsapp") }))
    .mutation(async ({ input }) => {
      const phone = normalizePhone(input.phone);
      const existing: any = await otpCodes.findOne({ phone }).lean();
      if (existing?.createdAt && Date.now() - new Date(existing.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait a moment before requesting another code" });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await otpCodes.findOneAndUpdate(
        { phone },
        { phone, code: hashCode(code), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
        { upsert: true },
      );
      const message = `Your Shamba Sokoni verification code is ${code}. It expires in 5 minutes.`;
      // Fire-and-forget, same convention as listing/order WhatsApp notifications —
      // both send functions already swallow their own errors and log them.
      if (input.channel === "sms") sendSms(phone, message).catch(() => {});
      else sendWhatsApp(phone, message).catch(() => {});
      return { sent: true, channel: input.channel };
    }),

  verifyOtp: publicQuery
    .input(z.object({ phone: z.string().min(9), code: z.string().min(4).max(8), name: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const phone = normalizePhone(input.phone);
      const record: any = await otpCodes.findOne({ phone }).lean();
      if (!record || new Date(record.expiresAt) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That code is invalid or has expired" });
      }
      if (record.attempts >= OTP_MAX_ATTEMPTS) {
        await otpCodes.deleteMany({ phone });
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please request a new code." });
      }
      if (hashCode(input.code) !== record.code) {
        await otpCodes.updateOne({ phone }, { $inc: { attempts: 1 } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "That code is invalid or has expired" });
      }
      await otpCodes.deleteMany({ phone });

      const user = await findOrCreateFarmerByPhone(phone, input.name);
      const token = await signSessionToken({ unionId: user.unionId, clientId: "shamba-web" });
      setSessionCookie(ctx, token, Session.maxAgeMs / 1000);

      return { id: user.id, name: user.name ?? null, phone: user.phone };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    setSessionCookie(ctx, "", 0);
    return { success: true };
  }),

  // A farmer's general plot size, separate from planting.updateFarmSize
  // (which corrects the size on one specific planting). Set here once in
  // their account, then used to prefill new plantings.
  updateFarmSize: authedQuery
    .input(z.object({ farmSizeAcres: z.number().positive().max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      await users.updateOne({ id: ctx.user.id }, { $set: { farmSizeAcres: input.farmSizeAcres } });
      return { success: true };
    }),

  // Saves a farm boundary traced either by tapping corners on a map or
  // walking the perimeter with GPS, and derives acreage from it — replaces
  // whatever farmSizeAcres was set manually, same as a real survey would.
  updateFarmBoundary: authedQuery
    .input(z.object({
      points: z.array(z.object({ lat: z.number(), lng: z.number() })).min(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const acres = polygonAcres(input.points);
      if (acres <= 0 || acres > 10_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That shape doesn't look like a valid farm boundary — please try tracing it again." });
      }
      await users.updateOne(
        { id: ctx.user.id },
        { $set: { farmBoundary: input.points, farmSizeAcres: acres } },
      );
      return { success: true, acres };
    }),

  // Starts an M-Pesa STK push for a Premium subscription. The price is
  // never trusted from the client — it's read from the admin-configured
  // setting, and checkout is refused outright if that hasn't been set yet
  // rather than falling back to a made-up number.
  startPremiumCheckout: authedQuery
    .input(z.object({ phone: z.string().min(9) }))
    .mutation(async ({ ctx, input }) => {
      const settings: any = await siteSettings.findOne({ key: "main" }).lean();
      const price = settings?.premiumMonthlyPriceKes;
      if (!price || price <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Premium isn't available for purchase yet — check back soon." });
      }

      const result = await stkPush({
        phone: input.phone,
        amount: price,
        accountRef: "ShambaPremium",
        description: "Shamba Premium",
      });

      const paymentId = await nextSeq("mpesa_payments");
      await mpesaPayments.create({
        id: paymentId,
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.merchantRequestId,
        phone: normalizeMpesaPhone(input.phone),
        amount: price,
        accountRef: "ShambaPremium",
        purpose: "premium",
        farmerId: ctx.user.id,
        status: "pending",
      });

      return { checkoutRequestId: result.checkoutRequestId, customerMessage: result.customerMessage };
    }),
});
