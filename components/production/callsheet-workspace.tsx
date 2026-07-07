"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CallSheetBuilder } from "@/components/production/callsheet-builder";
import { shortDate } from "@/lib/format";
import {
  createCallSheet,
  renameCallSheet,
  setCallSheetStatus,
  deleteCallSheet,
} from "@/app/(app)/projects/[id]/callsheet-actions";
import type { CallSheet as CS, CallSheetEntry } from "@/lib/database.types";

const STATUSES: { key: string; label: string; hue: string }[] = [
  { key: "draft", label: "Draft", hue: "amber" },
  { key: "sent", label: "Sent", hue: "blue" },
  { key: "confirmed", label: "Confirmed", hue: "green" },
];
const statusMeta = (s: string) =>
  STATUSES.find((x) => x.key === s) ?? STATUSES[0];

export function CallSheetWorkspace({
  projectId,
  projectTitle,
  sheets,
  entries,
  logoUrl,
}: {
  projectId: string;
  projectTitle: string;
  sheets: CS[];
  entries: CallSheetEntry[];
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(sheets[0]?.id ?? null);

  const active = sheets.find((s) => s.id === activeId) ?? sheets[0] ?? null;
  const activeEntries = active
    ? entries.filter((e) => e.call_sheet_id === active.id)
    : [];

  function newSheet() {
    start(async () => {
      const res = await createCallSheet(projectId);
      if ("id" in res) setActiveId(res.id);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteCallSheet(projectId, id);
      if (activeId === id) setActiveId(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
      {/* Sidebar: all call sheets */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Call sheets
          </span>
          <span className="text-xs font-semibold text-text-faint">{sheets.length}</span>
        </div>
        <div className="space-y-1">
          {sheets.map((s) => {
            const isActive = active?.id === s.id;
            const meta = statusMeta(s.status);
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full rounded-[10px] border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-transparent bg-accent-soft"
                    : "border-border hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm font-semibold ${
                      isActive ? "text-accent" : "text-text"
                    }`}
                  >
                    {s.title || "Untitled call sheet"}
                  </span>
                  <span
                    className="ml-auto shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `var(--h-${meta.hue}-bg)`,
                      color: `var(--h-${meta.hue})`,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-text-faint">
                  {s.shoot_date ? shortDate(s.shoot_date) : "No date set"}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={newSheet}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-2 text-sm font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          + New call sheet
        </button>
      </aside>

      {/* Active call sheet */}
      <div className="min-w-0">
        {!active ? (
          <div className="rounded-[14px] border border-dashed border-border py-16 text-center">
            <p className="text-sm text-text-faint">
              No call sheets yet. Create your first one.
            </p>
            <button
              onClick={newSheet}
              disabled={busy}
              className="mt-4 rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
            >
              + New call sheet
            </button>
          </div>
        ) : (
          <div>
            {/* Sheet header: title + status + delete */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                key={active.id}
                defaultValue={active.title ?? ""}
                onBlur={(e) => renameCallSheet(projectId, active.id, e.target.value)}
                placeholder="Call sheet name"
                className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 font-display text-lg font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
              />
              <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
                {STATUSES.map((st) => {
                  const on = active.status === st.key;
                  return (
                    <button
                      key={st.key}
                      onClick={() => {
                        start(async () => {
                          await setCallSheetStatus(projectId, active.id, st.key);
                          router.refresh();
                        });
                      }}
                      className="rounded-pill px-2.5 py-1 text-xs font-semibold transition"
                      style={
                        on
                          ? { backgroundColor: `var(--h-${st.hue}-bg)`, color: `var(--h-${st.hue})` }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => remove(active.id)}
                disabled={busy}
                className="shrink-0 text-text-faint transition hover:text-red"
                aria-label="Delete call sheet"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <CallSheetBuilder
              key={active.id}
              projectId={projectId}
              callSheetId={active.id}
              projectTitle={projectTitle}
              callSheet={active}
              entries={activeEntries}
              logoUrl={logoUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
