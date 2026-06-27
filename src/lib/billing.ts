import { createHmac, timingSafeEqual } from "crypto";

// Billing is implemented directly against the Stripe REST API so it requires no
// extra dependency. Every function is gated on the relevant env var being set;
// when keys are absent the feature is simply inactive (no fake behavior).

export const FREE_GENERATION_LIMIT = 3;

export function billingEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PRO,
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function stripeRequest(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? "Stripe request failed");
  }
  return json;
}

// Create a Checkout Session for the Pro plan and return its URL.
export async function createCheckoutSession(args: {
  userId: string;
  email: string;
  customerId?: string | null;
}): Promise<string> {
  const priceId = process.env.STRIPE_PRICE_ID_PRO!;
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl()}/app?upgraded=1`,
    cancel_url: `${appUrl()}/app/billing?canceled=1`,
    client_reference_id: args.userId,
    "metadata[userId]": args.userId,
  };
  if (args.customerId) params.customer = args.customerId;
  else params.customer_email = args.email;

  const session = await stripeRequest("checkout/sessions", params);
  return String(session.url);
}

// Verify a Stripe webhook signature (t=...,v1=... scheme) and return the event.
export function verifyWebhook(
  payload: string,
  signatureHeader: string | null,
): Record<string, unknown> | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return null;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}
