"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
} from "@/app/(app)/projects/[id]/task-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { shortDate } from "@/lib/format";
import type { ProjectTask } from "@/lib/database.types";

const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ProjectTasks({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectTask[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const today = todayStr();

  function add() {
    const t = title.trim();
    if (!t) return;
    start(async () => {
      const res = await addProjectTask(projectId, t, due || null);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      setTitle("");
      setDue("");
      router.refresh();
    });
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.due_date) return b.due_date ? 1 : 0;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Add a task, e.g. Send treatment to client"
          className="min-w-0 flex-1"
        />
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-[150px]"
          aria-label="Due date"
        />
        <Button size="sm" onClick={add} disabled={pending || !title.trim()}>
          Add task
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-6 rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No tasks yet. Add the next things this project needs.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-text-faint">
            {openCount} open {openCount === 1 ? "task" : "tasks"}
          </p>
          <ul className="mt-1.5 space-y-1">
            {sorted.map((t) => {
              const overdue = !t.done && t.due_date && t.due_date < today;
              return (
                <li
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 transition hover:bg-surface-2/60"
                >
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await toggleProjectTask(
                          projectId,
                          t.id,
                          !t.done
                        );
                        if (res?.error) {
                          toast(res.error, "error");
                          return;
                        }
                        router.refresh();
                      })
                    }
                    className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition"
                    style={{
                      borderColor: t.done
                        ? "var(--h-green)"
                        : "var(--border-strong)",
                      backgroundColor: t.done ? "var(--h-green)" : "transparent",
                    }}
                    aria-label={t.done ? "Mark not done" : "Mark done"}
                  >
                    {t.done && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      t.done ? "text-text-faint line-through" : "text-text"
                    }`}
                  >
                    {t.title}
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
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await deleteProjectTask(projectId, t.id);
                        if (res?.error) {
                          toast(res.error, "error");
                          return;
                        }
                        router.refresh();
                      })
                    }
                    className="shrink-0 text-text-faint opacity-0 transition hover:text-red group-hover:opacity-100"
                    aria-label="Delete task"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
