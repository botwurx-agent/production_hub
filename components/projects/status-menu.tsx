"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateProjectStatus } from "@/app/(app)/projects/actions";
import { toast } from "@/components/ui/toast";
import { StatusTag } from "@/components/status-tag";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import { stageLabel } from "@/lib/project-types";
import type { ProjectStatus } from "@/lib/database.types";

/**
 * The project's status chip doubles as its control: click to move the project
 * to another stage. Color-as-signal plus the common action in one place.
 * Stage labels adapt to the project type (a generated project has no "Shoot").
 */
export function StatusMenu({
  projectId,
  status,
  projectType,
}: {
  projectId: string;
  status: ProjectStatus;
  projectType?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function move(next: ProjectStatus) {
    setOpen(false);
    if (next === status) return;
    startTransition(async () => {
      const res = await updateProjectStatus(projectId, next);
      if (res?.error) toast(res.error, "error");
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`transition ${pending ? "opacity-50" : ""}`}
        aria-label="Change stage"
      >
        <StatusTag hue={PROJECT_STATUS[status].hue}>
          {stageLabel(status, projectType)}
        </StatusTag>
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-44 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
            Move to stage
          </div>
          {PROJECT_STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                move(s);
              }}
              className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
                s === status ? "bg-surface-2" : ""
              }`}
            >
              <StatusTag hue={PROJECT_STATUS[s].hue}>
                {stageLabel(s, projectType)}
              </StatusTag>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
