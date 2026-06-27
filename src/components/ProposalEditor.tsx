"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProposalContent } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  id: string;
  initialTitle: string;
  initialClientName: string;
  initialClientCompany: string;
  initialStatus: string;
  shareId: string;
  acceptedBy: string | null;
  initialContent: ProposalContent;
}

export function ProposalEditor({
  id,
  initialTitle,
  initialClientName,
  initialClientCompany,
  initialStatus,
  shareId,
  acceptedBy,
  initialContent,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [clientName, setClientName] = useState(initialClientName);
  const [clientCompany, setClientCompany] = useState(initialClientCompany);
  const [status, setStatus] = useState(initialStatus);
  const [content, setContent] = useState<ProposalContent>(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const total = useMemo(
    () => content.pricing.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [content.pricing],
  );

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/${shareId}` : "";

  function updateSection(i: number, field: "heading" | "body", value: string) {
    setContent((c) => {
      const sections = [...c.sections];
      sections[i] = { ...sections[i], [field]: value };
      return { ...c, sections };
    });
  }
  function removeSection(i: number) {
    setContent((c) => ({
      ...c,
      sections: c.sections.filter((_, idx) => idx !== i),
    }));
  }
  function addSection() {
    setContent((c) => ({
      ...c,
      sections: [...c.sections, { heading: "New section", body: "" }],
    }));
  }

  function updatePricing(
    i: number,
    field: "name" | "description" | "amount",
    value: string,
  ) {
    setContent((c) => {
      const pricing = [...c.pricing];
      pricing[i] = {
        ...pricing[i],
        [field]: field === "amount" ? Number(value) || 0 : value,
      };
      return { ...c, pricing };
    });
  }
  function removePricing(i: number) {
    setContent((c) => ({
      ...c,
      pricing: c.pricing.filter((_, idx) => idx !== i),
    }));
  }
  function addPricing() {
    setContent((c) => ({
      ...c,
      pricing: [...c.pricing, { name: "New item", description: "", amount: 0 }],
    }));
  }

  async function save(newStatus?: string) {
    setSaving(true);
    setSaved(false);
    const body = {
      title,
      clientName,
      clientCompany,
      status: newStatus ?? status,
      content: { ...content, total },
    };
    const res = await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      if (newStatus) setStatus(newStatus);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Delete this proposal? This cannot be undone.")) return;
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  async function copyShare() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to proposals
        </Link>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={remove}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Share & status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              Status: <span className="capitalize">{status}</span>
            </p>
            {status === "accepted" && acceptedBy && (
              <p className="text-sm text-green-700">
                Accepted by {acceptedBy} 🎉
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "draft" && (
              <button
                onClick={() => save("sent")}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Mark as sent
              </button>
            )}
            <a
              href={`/p/${shareId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Preview client view
            </a>
            <button
              onClick={copyShare}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy share link"}
            </button>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Client name</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Client company</label>
            <input
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium">Executive summary</label>
        <textarea
          rows={3}
          value={content.summary}
          onChange={(e) =>
            setContent((c) => ({ ...c, summary: e.target.value }))
          }
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Sections</h2>
        {content.sections.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <input
                value={s.heading}
                onChange={(e) => updateSection(i, "heading", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-medium focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => removeSection(i)}
                className="shrink-0 text-sm text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <textarea
              rows={5}
              value={s.body}
              onChange={(e) => updateSection(i, "body", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        ))}
        <button
          onClick={addSection}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          + Add section
        </button>
      </div>

      {/* Pricing */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Pricing</h2>
        <div className="mt-3 space-y-3">
          {content.pricing.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-100 p-2"
            >
              <input
                value={p.name}
                onChange={(e) => updatePricing(i, "name", e.target.value)}
                placeholder="Item"
                className="col-span-4 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
              <input
                value={p.description ?? ""}
                onChange={(e) =>
                  updatePricing(i, "description", e.target.value)
                }
                placeholder="Description"
                className="col-span-5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
              <input
                type="number"
                value={p.amount}
                onChange={(e) => updatePricing(i, "amount", e.target.value)}
                className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => removePricing(i)}
                className="col-span-1 text-sm text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={addPricing}
            className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            + Add line item
          </button>
          <p className="text-lg font-bold">
            Total: {formatCurrency(total, content.currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
