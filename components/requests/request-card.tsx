"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import { getRequestFileUrl } from "@/app/(app)/clients/request-actions";
import type { StoredRequestFile } from "@/lib/job-request";

export type RequestCardData = {
  id: string;
  title: string;
  details: string | null;
  neededBy: string | null;
  budget: number | null;
  contactName: string;
  contactEmail: string;
  files: StoredRequestFile[];
  createdAt: string;
};

function day(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function size(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

/**
 * What the client wrote when they asked for this job, on the deal it became.
 * The deal's own fields (title, value) are the studio's to edit from here on;
 * this card is the record of what was ASKED, so it stays as sent.
 */
export function RequestCard({ request }: { request: RequestCardData }) {
  const [opening, setOpening] = useState<string | null>(null);

  async function open(path: string) {
    setOpening(path);
    // Opened before the await so a popup blocker treats it as the click's.
    const win = window.open("", "_blank");
    try {
      const res = await getRequestFileUrl(request.id, path);
      const err = actionError(res);
      if (err || !("url" in res)) {
        win?.close();
        toast(err ?? "The file could not be opened.", "error");
        return;
      }
      if (win) win.location.href = res.url;
      else window.location.href = res.url;
    } finally {
      setOpening(null);
    }
  }

  const facts: [string, string][] = [
    ["From", `${request.contactName} (${request.contactEmail})`],
    ["Sent", day(request.createdAt)],
  ];
  if (request.neededBy) facts.push(["Needed by", day(request.neededBy)]);
  if (request.budget != null) facts.push(["Budget", `$${request.budget.toLocaleString("en-US")}`]);

  return (
    <section className="mb-6 rounded-[16px] border border-border bg-surface p-5" data-request-card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-text">Requested by the client</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-pink)" }} />
          Request link
        </span>
      </div>
      <p className="text-[15px] font-semibold text-text">{request.title}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex min-w-0 gap-2 text-sm">
            <dt className="shrink-0 text-text-faint">{k}</dt>
            <dd className="min-w-0 break-words text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {request.details && (
        <p className="mt-4 whitespace-pre-wrap break-words border-t border-border pt-4 text-sm text-text">
          {request.details}
        </p>
      )}
      {request.files.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
          {request.files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => open(f.path)}
                disabled={opening === f.path}
                className="min-w-0 truncate text-left font-semibold text-accent hover:underline disabled:opacity-60"
              >
                {f.name}
              </button>
              <span className="shrink-0 text-xs text-text-faint">{size(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
