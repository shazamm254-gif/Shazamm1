"use client";

import { useEffect } from "react";

// Fires a single client-side analytics event on mount. Generates and persists
// an anonymous visitor id in localStorage (no PII, no cookies).
export function AnalyticsBeacon({
  type,
  proposalId,
}: {
  type: "page_view" | "proposal_viewed";
  proposalId?: string;
}) {
  useEffect(() => {
    let anonId = localStorage.getItem("pf_anon");
    if (!anonId) {
      anonId =
        (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(
          /-/g,
          "",
        );
      localStorage.setItem("pf_anon", anonId);
    }
    // Dedupe rapid double-fires (e.g. React strict mode) per page+proposal.
    const key = `pf_sent_${type}_${proposalId ?? "_"}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, anonId, proposalId }),
      keepalive: true,
    }).catch(() => {});
  }, [type, proposalId]);

  return null;
}
