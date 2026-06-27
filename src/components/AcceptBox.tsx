"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptBox({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/public/${shareId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptedBy: name }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not accept. Please try again.");
    }
  }

  return (
    <form onSubmit={accept} className="text-center">
      <p className="font-medium">Ready to move forward?</p>
      <p className="mt-1 text-sm text-slate-500">
        Type your name to accept this proposal.
      </p>
      <div className="mx-auto mt-4 flex max-w-md flex-col gap-2 sm:flex-row">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-6 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Accepting…" : "Accept proposal"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
