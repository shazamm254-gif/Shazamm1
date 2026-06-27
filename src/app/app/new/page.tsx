"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProposalPage() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLimitReached(false);
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief, clientName, clientCompany, title }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      router.push(`/app/proposals/${data.id}`);
      router.refresh();
    } else if (res.status === 402) {
      setLimitReached(true);
    } else {
      setError(data.error ?? data.message ?? "Generation failed.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New proposal</h1>
      <p className="mt-1 text-slate-600">
        Describe the project. The more context you give, the sharper the draft.
      </p>

      {limitReached ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-900">
            You&apos;ve used your free proposals.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Upgrade to Pro for unlimited generations.
          </p>
          <Link
            href="/app/billing"
            className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
          >
            Upgrade to Pro
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Client name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Client company
              </label>
              <input
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="Acme Inc."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">
              Proposal title (optional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign proposal"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Project brief / discovery notes
            </label>
            <textarea
              required
              rows={8}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Acme needs a new marketing website. 6 pages, modern design, CMS so their team can edit. They mentioned a $15-20k budget and want to launch in 8 weeks…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || brief.trim().length < 10}
              className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate proposal"}
            </button>
            <Link
              href="/app"
              className="rounded-lg border border-slate-200 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
          {loading && (
            <p className="text-sm text-slate-500">
              Drafting your proposal — this takes about 15–30 seconds.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
