"use client";

import { useRef, useState, useTransition } from "react";
import { updateProjectStatus } from "@/app/(app)/projects/actions";
import { toast } from "@/components/ui/toast";
import { StatusTag } from "@/components/status-tag";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import { stageLabel } from "@/lib/project-types";
import type { ProjectStatus } from "@/lib/database.types";

/**
 * The project's status chip doubles as its control: click to move the project
 * to another stage. Color-as-signal plus the common action in one place.
 * Stage labels adapt to the project type (a generated project has no "Shoot").
 *
 * The menu portals out to the body rather than positioning inside the card.
 * On the board the card is an `overflow-hidden` Link, which silently clipped
 * an absolutely positioned menu: you saw the "Move to stage" heading and none
 * of the stages under it, so the control looked broken rather than cut off.
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
  const anchorRef = useRef<HTMLButtonElement>(null);

  function move(next: ProjectStatus) {
    setOpen(false);
    if (next === status) return;
    startTransition(async () => {
      const res = await updateProjectStatus(projectId, next);
      if (res?.error) toast(res.error, "error");
      else toast(`Moved to ${stageLabel(next, projectType)}`);
    });
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          // The card is a Link; keep a click on the chip from navigating.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`transition ${pending ? "opacity-50" : ""}`}
        aria-label="Change stage"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusTag hue={PROJECT_STATUS[status].hue}>
          {stageLabel(status, projectType)}
        </StatusTag>
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        width={186}
        prefer="below"
      >
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
          Move to stage
        </div>
        {PROJECT_STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
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
            {s === status && (
              <span className="ml-auto text-xs text-text-faint">Current</span>
            )}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}
