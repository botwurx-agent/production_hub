"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleTask } from "@/app/(app)/pipeline/crm-actions";
import { toggleProjectTask } from "@/app/(app)/projects/[id]/task-actions";
import { shortDate } from "@/lib/format";

export type DashboardTask = {
  id: string;
  title: string;
  due_date: string | null;
  kind: "crm" | "project";
  // CRM task context
  deal_id: string | null;
  account_id: string | null;
  deal_title: string | null;
  account_name: string | null;
  // Project task context
  project_id: string | null;
  project_title: string | null;
};

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function TaskWidget({ tasks }: { tasks: DashboardTask[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = todayStr();

  if (tasks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-faint">
        No open tasks. You&apos;re clear.
      </p>
    );
  }

  // Open tasks sorted by due date (dated first, then undated).
  const sorted = [...tasks].sort((a, b) => {
    if (!a.due_date) return b.due_date ? 1 : 0;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <ul className={`space-y-1 ${pending ? "opacity-60" : ""}`}>
      {sorted.map((t) => {
        const overdue = t.due_date && t.due_date < today;
        const href =
          t.kind === "project" && t.project_id
            ? `/projects/${t.project_id}/tasks`
            : t.deal_id
            ? `/pipeline/${t.deal_id}`
            : t.account_id
            ? `/clients/${t.account_id}`
            : null;
        const context =
          t.kind === "project" ? t.project_title : t.deal_title || t.account_name;
        return (
          <li
            key={`${t.kind}-${t.id}`}
            className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 transition hover:bg-surface-2/60"
          >
            <button
              onClick={() =>
                start(async () => {
                  if (t.kind === "project" && t.project_id) {
                    await toggleProjectTask(t.project_id, t.id, true);
                  } else {
                    await toggleTask(t.id, true, t.deal_id, t.account_id);
                  }
                  router.refresh();
                })
              }
              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border border-border-strong transition hover:border-[var(--h-green)]"
              aria-label="Mark done"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text">{t.title}</span>
              {context && (
                <span className="block truncate text-xs text-text-faint">
                  {context}
                </span>
              )}
            </span>
            {t.due_date && (
              <span
                className="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
                style={
                  overdue
                    ? { backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }
                    : { color: "var(--text-faint)" }
                }
              >
                {shortDate(t.due_date)}
              </span>
            )}
            {href && (
              <Link
                href={href}
                className="shrink-0 text-text-faint transition hover:text-accent"
                aria-label="Open"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
