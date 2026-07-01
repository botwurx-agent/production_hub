"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateAssetStatus } from "@/app/(app)/projects/[id]/actions";
import { StatusTag } from "@/components/status-tag";
import { ASSET_STATUS, ASSET_STATUS_ORDER } from "@/lib/status";
import type { AssetStatus } from "@/lib/database.types";

export function AssetStatusMenu({
  assetId,
  status,
}: {
  assetId: string;
  status: AssetStatus;
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

  function set(next: AssetStatus) {
    setOpen(false);
    if (next === status) return;
    startTransition(() => updateAssetStatus(assetId, next));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={pending ? "opacity-50" : ""}
        aria-label="Change asset status"
      >
        <StatusTag hue={ASSET_STATUS[status].hue}>
          {ASSET_STATUS[status].label}
        </StatusTag>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-lg">
          {ASSET_STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => set(s)}
              className={`flex w-full items-center rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
                s === status ? "bg-surface-2" : ""
              }`}
            >
              <StatusTag hue={ASSET_STATUS[s].hue}>
                {ASSET_STATUS[s].label}
              </StatusTag>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
