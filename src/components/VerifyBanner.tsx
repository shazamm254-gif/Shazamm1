"use client";

import { useState } from "react";

export function VerifyBanner() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function resend() {
    setState("sending");
    await fetch("/api/auth/resend-verification", { method: "POST" });
    setState("sent");
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      Please verify your email address.{" "}
      {state === "sent" ? (
        <span className="font-medium">Verification email sent ✓</span>
      ) : (
        <button
          onClick={resend}
          disabled={state === "sending"}
          className="font-semibold underline disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );
}
