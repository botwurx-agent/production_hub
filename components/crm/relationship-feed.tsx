"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logActivity, deleteActivity } from "@/app/(app)/pipeline/crm-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CRM_ACTIVITY, CRM_MANUAL_ACTIVITY } from "@/lib/status";
import { timeAgo } from "@/lib/format";
import type { CrmActivityKind } from "@/lib/database.types";
import type { FeedEntry } from "@/lib/crm-feed";

// The account relationship timeline: a composer for manual entries (note/call/
// meeting/email) over a merged, read-only feed of activities + auto-logged
// linked email. Derived (email) entries are labelled and not deletable.
export function RelationshipFeed({
  accountId,
  entries,
}: {
  accountId: string;
  entries: FeedEntry[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<CrmActivityKind>("note");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      await logActivity({ accountId, kind, body: text });
      setBody("");
      router.refresh();
    });
  }

  return (
    <div>
      {/* Composer */}
      <div className="rounded-[12px] border border-border bg-surface p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CRM_MANUAL_ACTIVITY.map((k) => {
            const meta = CRM_ACTIVITY[k];
            const active = k === kind;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="rounded-pill px-2.5 py-1 text-xs font-semibold transition"
                style={
                  active
                    ? {
                        backgroundColor: `var(--h-${meta.hue}-bg)`,
                        color: `var(--h-${meta.hue})`,
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Log a ${CRM_ACTIVITY[kind].label.toLowerCase()}...`}
          className="min-h-[64px]"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? "Logging..." : "Log"}
          </Button>
        </div>
      </div>

      {/* Merged timeline */}
      {entries.length === 0 ? (
        <p className="mt-4 text-center text-xs text-text-faint">
          No activity yet. Log a call or note, or link an email thread in the
          Communication tab.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((e) => {
            const meta = e.kind ? CRM_ACTIVITY[e.kind] : CRM_ACTIVITY.note;
            const label = e.source === "email" ? "Email" : meta.label;
            return (
              <li key={e.id} className="group flex gap-3">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--h-${meta.hue})` }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-xs font-bold"
                      style={{ color: `var(--h-${meta.hue})` }}
                    >
                      {label}
                    </span>
                    {e.source === "email" && (
                      <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-faint">
                        auto
                      </span>
                    )}
                    <span className="text-xs text-text-faint">
                      {timeAgo(e.at)}
                    </span>
                    {e.deletable && (
                      <button
                        onClick={() =>
                          start(async () => {
                            await deleteActivity(e.id, null, accountId);
                            router.refresh();
                          })
                        }
                        className="ml-auto text-text-faint opacity-0 transition hover:text-red group-hover:opacity-100"
                        aria-label="Delete activity"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {e.title && (
                    <p className="truncate text-sm font-medium text-text">
                      {e.title}
                    </p>
                  )}
                  {e.body && (
                    <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                      {e.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
