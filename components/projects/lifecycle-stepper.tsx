"use client";

import { useTransition } from "react";
import { updateProjectStatus } from "@/app/(app)/projects/actions";
import { toast } from "@/components/ui/toast";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import { stageLabel } from "@/lib/project-types";
import type { ProjectStatus } from "@/lib/database.types";

/**
 * Where the job stands, and how you move it. The stepper used to be a plain
 * row of divs, which meant the biggest, most obvious "this is your stage"
 * element on the page did nothing when clicked, and the only real control was
 * a small chip up in the corner. Now the thing that looks like the control is
 * the control.
 *
 * Stage names come from the project's type: a live-action job shoots, an AI
 * job generates, a CG job produces. The underlying four phases never change.
 */
export function LifecycleStepper({
  projectId,
  status,
  projectType,
  canEdit = true,
}: {
  projectId: string;
  status: ProjectStatus;
  projectType?: string | null;
  canEdit?: boolean;
}) {
  const [pending, start] = useTransition();
  const currentOrder = PROJECT_STATUS[status].order;

  function move(next: ProjectStatus) {
    if (next === status || !canEdit) return;
    start(async () => {
      const res = await updateProjectStatus(projectId, next);
      if (res?.error) toast(res.error, "error");
      else toast(`Moved to ${stageLabel(next, projectType)}`);
    });
  }

  return (
    <div
      className={`mt-5 flex flex-wrap gap-2 ${pending ? "opacity-60" : ""}`}
      role={canEdit ? "group" : undefined}
      aria-label={canEdit ? "Project stage" : undefined}
    >
      {PROJECT_STATUS_ORDER.map((s, i) => {
        const info = PROJECT_STATUS[s];
        const state =
          info.order < currentOrder
            ? "done"
            : info.order === currentOrder
              ? "current"
              : "todo";
        const label = stageLabel(s, projectType);

        const inner = (
          <>
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[10px] text-white"
              style={{
                backgroundColor:
                  state === "done"
                    ? "var(--h-green)"
                    : state === "current"
                      ? "var(--accent)"
                      : "var(--border-strong)",
              }}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            {label}
          </>
        );

        const style = {
          backgroundColor:
            state === "current" ? "var(--accent-soft)" : "var(--surface-2)",
          color:
            state === "current"
              ? "var(--accent)"
              : state === "done"
                ? "var(--text-muted)"
                : "var(--text-faint)",
        };

        if (!canEdit) {
          return (
            <div
              key={s}
              className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-bold"
              style={style}
            >
              {inner}
            </div>
          );
        }

        return (
          <button
            key={s}
            type="button"
            onClick={() => move(s)}
            disabled={pending}
            aria-current={state === "current" ? "step" : undefined}
            title={
              state === "current"
                ? `${label} (current stage)`
                : `Move this project to ${label}`
            }
            className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-bold transition hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait"
            style={style}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
