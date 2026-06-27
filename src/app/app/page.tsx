import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { FREE_GENERATION_LIMIT } from "@/lib/billing";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const proposals = db.proposals.listByUser(user.id);

  const remaining =
    user.plan === "pro"
      ? null
      : Math.max(0, FREE_GENERATION_LIMIT - user.generationsUsed);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your proposals</h1>
          {remaining !== null && (
            <p className="mt-1 text-sm text-slate-500">
              {remaining} of {FREE_GENERATION_LIMIT} free proposals remaining.
            </p>
          )}
        </div>
        <Link
          href="/app/new"
          className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
        >
          + New proposal
        </Link>
      </div>

      {!user.company && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Set up your{" "}
          <Link href="/app/settings" className="font-semibold underline">
            company profile
          </Link>{" "}
          so every proposal is on-brand and references your real services.
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-600">No proposals yet.</p>
          <Link
            href="/app/new"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
          >
            Create your first proposal
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {proposals.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/proposals/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[p.clientName, p.clientCompany].filter(Boolean).join(" · ") ||
                      "No client set"}{" "}
                    · {formatDate(p.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {p.amount != null && (
                    <span className="text-sm font-medium">
                      {formatCurrency(p.amount, p.currency)}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      statusStyles[p.status] ?? statusStyles.draft
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
