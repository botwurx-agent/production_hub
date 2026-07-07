"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCallSheet } from "@/app/c/[token]/actions";

export function ConfirmBar({
  token,
  confirmed,
}: {
  token: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const res = await confirmCallSheet(token);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (confirmed) {
    return (
      <div
        className="flex items-center gap-2 rounded-[12px] border px-4 py-3 text-sm font-bold"
        style={{ borderColor: "var(--green)", backgroundColor: "var(--green-bg)", color: "var(--green)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        You&apos;re confirmed. See you on set!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-text">Can you make it?</span>
      <div className="flex items-center gap-3">
        {error && <span className="text-xs font-medium text-red">{error}</span>}
        <button
          onClick={confirm}
          disabled={busy}
          className="rounded-[11px] bg-accent px-5 py-2 text-sm font-bold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Confirming..." : "Confirm I'll be there"}
        </button>
      </div>
    </div>
  );
}
