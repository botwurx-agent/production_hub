"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateLeadStage } from "@/app/(app)/leads/actions";
import { StatusTag } from "@/components/status-tag";
import { LEAD_STAGE, LEAD_STAGE_ORDER } from "@/lib/status";
import type { LeadStage } from "@/lib/database.types";

export function LeadStageMenu({
  leadId,
  stage,
}: {
  leadId: string;
  stage: LeadStage;
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

  function set(next: LeadStage) {
    setOpen(false);
    if (next === stage) return;
    start(() => updateLeadStage(leadId, next));
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={pending ? "opacity-50" : ""}
        aria-label="Change stage"
      >
        <StatusTag hue={LEAD_STAGE[stage].hue}>
          {LEAD_STAGE[stage].label}
        </StatusTag>
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-44 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-lg">
          {LEAD_STAGE_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => set(s)}
              className={`flex w-full items-center rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
                s === stage ? "bg-surface-2" : ""
              }`}
            >
              <StatusTag hue={LEAD_STAGE[s].hue}>{LEAD_STAGE[s].label}</StatusTag>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
