"use client";

import { useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { listAgentThreads, type ThreadSummary } from "@/app/(app)/agent-actions";

/**
 * Past conversations, grouped by the job they were about.
 *
 * Grouped rather than a flat list because that is the question being asked:
 * not "what did I say last Tuesday" but "what have I been asking about Hint".
 * The studio-wide ones sit in their own group, since a question like "what is
 * at risk everywhere" belongs to no project and would be misfiled under any.
 */
export function ThreadHistory({
  activeId,
  onPick,
}: {
  activeId: string | null;
  onPick: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listAgentThreads().then((rows) => {
      if (alive) setThreads(rows);
    });
    return () => {
      alive = false;
    };
    // Reloaded on each open rather than cached: a conversation held since the
    // list was last fetched should be at the top when you look again.
  }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = groupByProject(threads ?? []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Past conversations"
        aria-label="Past conversations"
        className="rounded-[8px] px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text"
      >
        <HistoryIcon />
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-10 max-h-[380px] w-[300px] overflow-y-auto rounded-[12px] border border-border bg-surface p-1.5 shadow-lg">
          {threads === null ? (
            <p className="px-2 py-3 text-xs text-text-faint">Loading...</p>
          ) : threads.length === 0 ? (
            <p className="px-2 py-3 text-xs text-text-faint">
              Nothing yet. Conversations show up here once you have had one.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="mb-1 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-text-faint">
                  {g.label}
                </p>
                {g.threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onPick(t.id);
                    }}
                    className={`block w-full rounded-[8px] px-2 py-1.5 text-left ${
                      t.id === activeId
                        ? "bg-accent-soft text-accent"
                        : "text-text hover:bg-surface-2"
                    }`}
                  >
                    <span className="block truncate text-xs font-medium">
                      {t.title || "Untitled"}
                    </span>
                    <span className="block text-[10px] text-text-faint">
                      {timeAgo(t.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

type Group = { key: string; label: string; threads: ThreadSummary[] };

function groupByProject(threads: ThreadSummary[]): Group[] {
  const groups: Group[] = [];
  const index = new Map<string, Group>();

  // Insertion order follows the list, which is newest first, so the job you
  // were last talking about is the group at the top.
  for (const t of threads) {
    const key = t.projectId ?? "studio";
    const label = t.projectId
      ? (t.projectTitle ?? "A project that no longer exists")
      : "Whole studio";
    let group = index.get(key);
    if (!group) {
      group = { key, label, threads: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.threads.push(t);
  }

  return groups;
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}
