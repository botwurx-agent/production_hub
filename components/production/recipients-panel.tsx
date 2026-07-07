"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addCallSheetRecipient,
  deleteCallSheetRecipient,
} from "@/app/(app)/projects/[id]/callsheet-actions";
import type { CallSheetRecipient } from "@/lib/database.types";

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

function fmt(ts: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function RecipientsPanel({
  projectId,
  callSheetId,
  recipients,
}: {
  projectId: string;
  callSheetId: string;
  recipients: CallSheetRecipient[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin =
    siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const linkFor = (token: string) => `${origin}/c/${token}`;

  function add() {
    if (!name.trim()) return setError("Add a name.");
    setError(null);
    start(async () => {
      const res = await addCallSheetRecipient(projectId, callSheetId, name, email);
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setEmail("");
        router.refresh();
      }
    });
  }

  function copy(token: string) {
    const url = linkFor(token);
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(token);
        setTimeout(() => setCopied(null), 1800);
      },
      () => {}
    );
  }

  function remove(id: string) {
    start(async () => {
      await deleteCallSheetRecipient(projectId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Add each person, then copy their private link to send (email, text, Slack).
        You&apos;ll see when they view it and when they confirm. No login needed.
      </p>

      {/* Add */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={inputCls}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className={inputCls}
        />
        <Button onClick={add} disabled={busy}>
          {busy ? "Adding..." : "Add"}
        </Button>
      </div>
      {error && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{error}</p>
      )}

      {/* List */}
      {recipients.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No recipients yet. Add crew and talent to send them the call sheet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_auto] gap-2 border-b border-border bg-surface-2/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <span>Recipient</span>
            <span>Viewed</span>
            <span>Confirmed</span>
            <span />
          </div>
          {recipients.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_auto] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{r.name}</div>
                {r.email && <div className="truncate text-xs text-text-faint">{r.email}</div>}
              </div>
              <span>
                {r.viewed_at ? (
                  <span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: "var(--h-blue-bg)", color: "var(--h-blue)" }}>
                    {fmt(r.viewed_at)}
                  </span>
                ) : (
                  <span className="text-xs text-text-faint">—</span>
                )}
              </span>
              <span>
                {r.confirmed_at ? (
                  <span className="rounded-pill px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: "var(--green-bg)", color: "var(--green)" }}>
                    {fmt(r.confirmed_at)}
                  </span>
                ) : (
                  <span className="text-xs text-text-faint">—</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copy(r.token)}
                  className="rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  {copied === r.token ? "Copied" : "Copy link"}
                </button>
                <button
                  onClick={() => remove(r.id)}
                  disabled={busy}
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Remove recipient"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
