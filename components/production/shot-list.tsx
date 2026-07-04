"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addShot,
  updateShot,
  deleteShot,
  swapShots,
} from "@/app/(app)/projects/[id]/production/actions";
import type { Shot } from "@/lib/database.types";

const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function ShotList({ projectId, shots }: { projectId: string; shots: Shot[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Shot[]>(shots);
  const sig = shots.map((s) => `${s.id}:${s.position}`).join(",");
  useEffect(() => {
    setRows(shots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function edit(id: string, patch: Partial<Shot>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function toggle(r: Shot) {
    const status = r.status === "done" ? "todo" : "done";
    edit(r.id, { status });
    void updateShot(projectId, r.id, { status });
  }
  function add() {
    start(async () => {
      await addShot(projectId);
      router.refresh();
    });
  }
  function del(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteShot(projectId, id);
      router.refresh();
    });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    start(async () => {
      await swapShots(
        projectId,
        { id: a.id, position: a.position },
        { id: b.id, position: b.position }
      );
      router.refresh();
    });
  }

  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {rows.length} shot{rows.length === 1 ? "" : "s"}
          {rows.length > 0 && (
            <span className="text-text-faint"> · {doneCount} done</span>
          )}
        </p>
        <Button size="sm" onClick={add} disabled={busy}>
          + Shot
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
          No shots yet. Build your shot list for the shoot.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const done = r.status === "done";
            return (
              <li
                key={r.id}
                className="rounded-[12px] border border-border bg-surface p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-text-faint">
                    {i + 1}
                  </span>
                  <button
                    onClick={() => toggle(r)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition ${
                      done
                        ? "border-green bg-green text-white"
                        : "border-border-strong hover:border-green"
                    }`}
                    aria-label="Toggle done"
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                  <input
                    value={r.scene ?? ""}
                    onChange={(e) => edit(r.id, { scene: e.target.value })}
                    onBlur={() => updateShot(projectId, r.id, { scene: r.scene ?? "" })}
                    placeholder="Shot #"
                    className={`${cell} w-20 shrink-0 font-semibold`}
                  />
                  <input
                    value={r.description}
                    onChange={(e) => edit(r.id, { description: e.target.value })}
                    onBlur={() =>
                      updateShot(projectId, r.id, { description: r.description })
                    }
                    placeholder="What's the shot?"
                    className={`${cell} flex-1 ${done ? "text-text-faint line-through" : ""}`}
                  />
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || busy}
                      className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === rows.length - 1 || busy}
                      className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => del(r.id)}
                      className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-red-bg hover:text-red"
                      aria-label="Delete shot"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex gap-2 pl-[3.1rem]">
                  <input
                    value={r.setup ?? ""}
                    onChange={(e) => edit(r.id, { setup: e.target.value })}
                    onBlur={() => updateShot(projectId, r.id, { setup: r.setup ?? "" })}
                    placeholder="Location / setup"
                    className={`${cell} w-52`}
                  />
                  <input
                    value={r.notes ?? ""}
                    onChange={(e) => edit(r.id, { notes: e.target.value })}
                    onBlur={() => updateShot(projectId, r.id, { notes: r.notes ?? "" })}
                    placeholder="Notes"
                    className={`${cell} flex-1`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
