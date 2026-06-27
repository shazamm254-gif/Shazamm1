import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhook } from "@/lib/billing";
import { sendBillingNotification } from "@/lib/email";
import { track } from "@/lib/analytics";

// Stripe webhook: on successful checkout / active subscription, upgrade the
// user to Pro. Verified via the Stripe signature header.
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = verifyWebhook(payload, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const type = String(event.type);
  const data = (event.data as { object?: Record<string, unknown> })?.object;

  if (type === "checkout.session.completed" && data) {
    const userId =
      (data.client_reference_id as string) ||
      ((data.metadata as Record<string, string> | undefined)?.userId ?? "");
    const customerId =
      typeof data.customer === "string" ? data.customer : undefined;
    if (userId) {
      await db.users.update(userId, {
        plan: "pro",
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      });
      const user = await db.users.findById(userId);
      if (user) await sendBillingNotification(user.email, user.name, "upgraded");
      await track({ type: "subscription_started", userId });
    }
  }

  if (type === "customer.subscription.deleted" && data) {
    const customerId =
      typeof data.customer === "string" ? data.customer : undefined;
    if (customerId) {
      const user = await db.users.findByStripeCustomer(customerId);
      if (user) {
        await db.users.update(user.id, { plan: "free" });
        await sendBillingNotification(user.email, user.name, "downgraded");
      }
    }
  }

  return NextResponse.json({ received: true });
}
