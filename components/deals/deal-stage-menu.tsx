"use client";

import { useRef, useState, useTransition } from "react";
import { updateDealStage } from "@/app/(app)/pipeline/actions";
import { StatusTag } from "@/components/status-tag";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { DEAL_STAGE, DEAL_STAGE_ORDER } from "@/lib/status";
import type { DealStage } from "@/lib/database.types";

/**
 * The deal's stage chip doubles as its control: click to move the deal across
 * the pipeline.
 *
 * The menu portals out to the body rather than positioning inside the card,
 * the same fix the project board's StatusMenu needed: on the board the card
 * sits inside a scrolling column, so an absolutely positioned menu was
 * clipped at the card's edge and the control looked broken rather than cut
 * off.
 */
export function DealStageMenu({
  dealId,
  stage,
}: {
  dealId: string;
  stage: DealStage;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const anchorRef = useRef<HTMLButtonElement>(null);

  function set(next: DealStage) {
    setOpen(false);
    if (next === stage) return;
    start(() => updateDealStage(dealId, next));
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`transition ${pending ? "opacity-50" : ""}`}
        aria-label="Change stage"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusTag hue={DEAL_STAGE[stage].hue}>
          {DEAL_STAGE[stage].label}
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
        {DEAL_STAGE_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              set(s);
            }}
            className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
              s === stage ? "bg-surface-2" : ""
            }`}
          >
            <StatusTag hue={DEAL_STAGE[s].hue}>{DEAL_STAGE[s].label}</StatusTag>
            {s === stage && (
              <span className="ml-auto text-xs text-text-faint">Current</span>
            )}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}
