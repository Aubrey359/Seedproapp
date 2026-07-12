import { env } from "./env";

const BASE_URL = env.paypal.env === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// ── OAuth access token (client credentials) ────────────────────
let cachedToken = "";
let tokenExpiry = 0;

async function getPaypalToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(`${env.paypal.clientId}:${env.paypal.clientSecret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Create Order ────────────────────────────────────────────────
export interface CreateOrderParams {
  amountUsd: number;
  referenceId: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateOrderResult {
  orderId: string;
  approveUrl: string;
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const token = await getPaypalToken();

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.referenceId,
        amount: { currency_code: "USD", value: params.amountUsd.toFixed(2) },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Shamba Sokoni",
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      },
    },
  };

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`PayPal create order failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as any;
  const approveLink = (data.links || []).find((l: any) => l.rel === "approve" || l.rel === "payer-action");
  if (!approveLink) throw new Error("PayPal did not return an approval link");

  return { orderId: data.id, approveUrl: approveLink.href };
}

// ── Capture Order (after buyer approval) ────────────────────────
export interface CaptureResult {
  status: string; // "COMPLETED" on success
  captureId: string | null;
  payerEmail: string | null;
  raw: any;
}

export async function captureOrder(orderId: string): Promise<CaptureResult> {
  const token = await getPaypalToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  const data = (await res.json()) as any;
  const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    status: data.status,
    captureId: capture?.id ?? null,
    payerEmail: data?.payer?.email_address ?? null,
    raw: data,
  };
}
