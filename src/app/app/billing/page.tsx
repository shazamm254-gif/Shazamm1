import { getCurrentUser } from "@/lib/auth";
import { billingEnabled, FREE_GENERATION_LIMIT } from "@/lib/billing";
import { UpgradeButton } from "@/components/UpgradeButton";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const enabled = billingEnabled();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-slate-600">
        You are on the{" "}
        <span className="font-semibold capitalize">{user.plan}</span> plan.
      </p>

      {user.plan === "pro" ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="font-medium text-green-900">
            You&apos;re on Pro — unlimited proposals. Thank you! 🎉
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-brand bg-white p-8">
          <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
          <p className="mt-2 text-3xl font-extrabold">
            $39
            <span className="text-base font-medium text-slate-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-slate-600">
            <li>✓ Unlimited AI proposals</li>
            <li>✓ Custom branding</li>
            <li>✓ Accept tracking</li>
            <li>✓ Priority support</li>
          </ul>
          <p className="mt-4 text-sm text-slate-500">
            Free plan includes {FREE_GENERATION_LIMIT} proposals
            (you&apos;ve used {user.generationsUsed}).
          </p>
          <div className="mt-6">
            {enabled ? (
              <UpgradeButton />
            ) : (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                Billing isn&apos;t configured on this deployment yet. Add Stripe
                keys to enable upgrades.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
