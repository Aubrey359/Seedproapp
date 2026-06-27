import { env } from "./env";

const BASE_URL = env.mpesa.env === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// ── OAuth access token ─────────────────────────────────────────
let cachedToken = "";
let tokenExpiry  = 0;

export async function getMpesaToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(`${env.mpesa.consumerKey}:${env.mpesa.consumerSecret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });

  if (!res.ok) throw new Error(`Daraja OAuth failed: ${res.status} ${await res.text()}`);

  const data = await res.json() as { access_token: string; expires_in: string };
  cachedToken = data.access_token;
  tokenExpiry  = Date.now() + (parseInt(data.expires_in) - 60) * 1000;
  return cachedToken;
}

// ── STK Push (Lipa na M-Pesa Online) ──────────────────────────
export interface StkPushParams {
  phone:      string;   // 254XXXXXXXXX format
  amount:     number;   // KES, integer
  accountRef: string;   // e.g. "ORDER-42"
  description:string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode:      string;
  responseDescription: string;
  customerMessage:   string;
}

export async function stkPush(params: StkPushParams): Promise<StkPushResult> {
  const token     = await getMpesaToken();
  const timestamp = getTimestamp();
  const password  = getPassword(timestamp);

  // Normalize phone: strip leading 0, prefix 254
  const phone = normalizePhone(params.phone);

  const body = {
    BusinessShortCode: env.mpesa.shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            Math.ceil(params.amount),
    PartyA:            phone,
    PartyB:            env.mpesa.shortcode,
    PhoneNumber:       phone,
    CallBackURL:       env.mpesa.callbackUrl,
    AccountReference:  params.accountRef.slice(0, 12),
    TransactionDesc:   params.description.slice(0, 13),
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`STK Push failed: ${res.status} ${err}`);
  }

  const data = await res.json() as any;

  if (data.ResponseCode !== "0") {
    throw new Error(`STK Push error: ${data.ResponseDescription}`);
  }

  return {
    merchantRequestId:   data.MerchantRequestID,
    checkoutRequestId:   data.CheckoutRequestID,
    responseCode:        data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage:     data.CustomerMessage,
  };
}

// ── STK Push Status Query ──────────────────────────────────────
export interface StkQueryResult {
  resultCode: string;
  resultDesc: string;
  checkoutRequestId: string;
}

export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  const token     = await getMpesaToken();
  const timestamp = getTimestamp();
  const password  = getPassword(timestamp);

  const body = {
    BusinessShortCode: env.mpesa.shortcode,
    Password:          password,
    Timestamp:         timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  const data = await res.json() as any;
  return {
    resultCode:        data.ResultCode ?? data.errorCode ?? "9999",
    resultDesc:        data.ResultDesc ?? data.errorMessage ?? "Unknown",
    checkoutRequestId: data.CheckoutRequestID ?? checkoutRequestId,
  };
}

// ── Helpers ───────────────────────────────────────────────────
function getTimestamp(): string {
  return new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
}

function getPassword(timestamp: string): string {
  return Buffer.from(`${env.mpesa.shortcode}${env.mpesa.passkey}${timestamp}`).toString("base64");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0"))   return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}
