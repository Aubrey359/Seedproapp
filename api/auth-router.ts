import * as cookie from "hono/utils/cookie";
import { createHash } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { otpCodes } from "@db/schema";
import { findOrCreateFarmerByPhone } from "./lib/identity";
import { sendWhatsApp, sendSms } from "./whatsapp/send";
import { signSessionToken } from "./kimi/session";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
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
});
