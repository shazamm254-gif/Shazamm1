import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { since } = await searchParams;
  const sinceDays = since === "7" || since === "90" ? Number(since) : 30;
  const s = await db.events.summary(sinceDays);

  const funnelSteps = [
    { label: "Visitors", value: s.funnel.visitors },
    { label: "Signups", value: s.funnel.signups },
    { label: "Activated (generated ≥1)", value: s.funnel.activated },
    { label: "Sent a proposal", value: s.funnel.sent },
    { label: "Got an acceptance", value: s.funnel.accepted },
    { label: "Subscribed", value: s.funnel.subscribed },
  ];
  const top = Math.max(1, ...funnelSteps.map((f) => f.value));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/app/analytics?since=${d}`}
              className={`rounded-lg px-3 py-1.5 ${
                sinceDays === d
                  ? "bg-brand text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d}d
            </a>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">Last {s.sinceDays} days.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Visitors" value={s.visitors} />
        <Stat label="Signups" value={s.signups} />
        <Stat label="Proposal generations" value={s.generations} />
        <Stat label="Proposal views" value={s.proposalViews} />
        <Stat label="Acceptances" value={s.acceptances} />
        <Stat label="Subscriptions" value={s.subscriptions} />
        <Stat label="Activation rate" value={pct(s.activationRate)} />
        <Stat label="Free→paid conversion" value={pct(s.conversionRate)} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Conversion funnel</h2>
      <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-5">
        {funnelSteps.map((step, i) => {
          const prev = i === 0 ? null : funnelSteps[i - 1].value;
          const stepRate =
            prev && prev > 0 ? ` (${pct(step.value / prev)} of prev)` : "";
          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-48 shrink-0 text-sm text-slate-600">
                {step.label}
              </div>
              <div className="h-6 flex-1 rounded bg-slate-100">
                <div
                  className="flex h-6 items-center justify-end rounded bg-brand px-2 text-xs font-medium text-white"
                  style={{ width: `${Math.max(6, (step.value / top) * 100)}%` }}
                >
                  {step.value}
                </div>
              </div>
              <div className="w-32 shrink-0 text-right text-xs text-slate-400">
                {stepRate}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Visitors and proposal views are measured via an anonymous, cookie-free
        client beacon. Signups, generations, sends, acceptances, and
        subscriptions are recorded server-side.
      </p>
    </div>
  );
}
