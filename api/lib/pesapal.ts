import { env } from "./env";

const BASE_URL = env.pesapal.env === "production"
  ? "https://pay.pesapal.com/v3"
  : "https://cybqa.pesapal.com/pesapalv3";

// ── Auth token (valid ~5 minutes) ───────────────────────────────
let cachedToken = "";
let tokenExpiry = 0;

async function getPesapalToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_key: env.pesapal.consumerKey,
      consumer_secret: env.pesapal.consumerSecret,
    }),
  });

  const data = (await res.json()) as any;
  if (!res.ok || !data.token) {
    const detail = data.message || data.error?.message || JSON.stringify(data.error) || res.status;
    throw new Error(`Pesapal auth failed: ${detail}`);
  }

  cachedToken = data.token;
  tokenExpiry = Date.now() + 4 * 60 * 1000; // refresh a little before the ~5 min expiry
  return cachedToken;
}

// ── IPN registration (one-time; cached in-process) ──────────────
let cachedIpnId = "";

async function getIpnId(): Promise<string> {
  if (cachedIpnId) return cachedIpnId;
  const token = await getPesapalToken();

  const res = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ url: env.pesapal.ipnUrl, ipn_notification_type: "GET" }),
  });

  const data = (await res.json()) as any;
  if (!data.ipn_id) throw new Error(`Pesapal IPN registration failed: ${data.message || JSON.stringify(data)}`);

  cachedIpnId = data.ipn_id;
  return cachedIpnId;
}

// ── Submit order ─────────────────────────────────────────────────
export interface SubmitOrderParams {
  merchantReference: string;
  amount: number;
  description: string;
  callbackUrl: string;
  email?: string;
  phone?: string;
}

export interface SubmitOrderResult {
  orderTrackingId: string;
  redirectUrl: string;
}

export async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const token = await getPesapalToken();
  const notificationId = await getIpnId();

  const body = {
    id: params.merchantReference,
    currency: "KES",
    amount: params.amount,
    description: params.description.slice(0, 100),
    callback_url: params.callbackUrl,
    notification_id: notificationId,
    billing_address: {
      email_address: params.email || undefined,
      phone_number: params.phone || undefined,
    },
  };

  const res = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as any;
  if (!data.redirect_url) throw new Error(`Pesapal order submission failed: ${data.error?.message || JSON.stringify(data)}`);

  return { orderTrackingId: data.order_tracking_id, redirectUrl: data.redirect_url };
}

// ── Transaction status ───────────────────────────────────────────
export interface TransactionStatus {
  statusDescription: string; // INVALID | FAILED | COMPLETED | REVERSED
  amount: number;
  paymentMethod: string | null;
  merchantReference: string;
  confirmationCode: string | null;
  raw: any;
}

export async function getTransactionStatus(orderTrackingId: string): Promise<TransactionStatus> {
  const token = await getPesapalToken();

  const res = await fetch(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );

  const data = (await res.json()) as any;
  return {
    statusDescription: data.payment_status_description ?? "PENDING",
    amount: data.amount,
    paymentMethod: data.payment_method ?? null,
    merchantReference: data.merchant_reference,
    confirmationCode: data.confirmation_code ?? null,
    raw: data,
  };
}
