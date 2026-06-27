"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CompanyFields {
  name: string;
  website: string;
  industry: string;
  services: string;
  tone: string;
  valueProps: string;
  defaultCurrency: string;
}

export function CompanyForm({ initial }: { initial: CompanyFields }) {
  const router = useRouter();
  const [fields, setFields] = useState<CompanyFields>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CompanyFields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save.");
    }
  }

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium">Company name *</label>
        <input
          required
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          className={input}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Website</label>
          <input
            value={fields.website}
            onChange={(e) => set("website", e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Industry</label>
          <input
            value={fields.industry}
            onChange={(e) => set("industry", e.target.value)}
            className={input}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Services offered</label>
        <textarea
          rows={3}
          value={fields.services}
          onChange={(e) => set("services", e.target.value)}
          placeholder="e.g. Brand identity, web design & development, ongoing retainers…"
          className={input}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">
          Differentiators / value props
        </label>
        <textarea
          rows={2}
          value={fields.valueProps}
          onChange={(e) => set("valueProps", e.target.value)}
          placeholder="e.g. 10+ years in SaaS, fixed-fee pricing, 2-week turnaround…"
          className={input}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Tone</label>
          <input
            value={fields.tone}
            onChange={(e) => set("tone", e.target.value)}
            placeholder="professional, friendly, bold…"
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Default currency</label>
          <input
            value={fields.defaultCurrency}
            onChange={(e) => set("defaultCurrency", e.target.value.toUpperCase())}
            maxLength={3}
            className={input}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </form>
  );
}
