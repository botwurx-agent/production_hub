"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateDealStage } from "@/app/(app)/pipeline/actions";
import { StatusTag } from "@/components/status-tag";
import { DEAL_STAGE, DEAL_STAGE_ORDER } from "@/lib/status";
import type { DealStage } from "@/lib/database.types";

export function DealStageMenu({
  dealId,
  stage,
}: {
  dealId: string;
  stage: DealStage;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function set(next: DealStage) {
    setOpen(false);
    if (next === stage) return;
    start(() => updateDealStage(dealId, next));
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={pending ? "opacity-50" : ""}
        aria-label="Change stage"
      >
        <StatusTag hue={DEAL_STAGE[stage].hue}>
          {DEAL_STAGE[stage].label}
        </StatusTag>
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-44 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-lg">
          {DEAL_STAGE_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => set(s)}
              className={`flex w-full items-center rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
                s === stage ? "bg-surface-2" : ""
              }`}
            >
              <StatusTag hue={DEAL_STAGE[s].hue}>{DEAL_STAGE[s].label}</StatusTag>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
