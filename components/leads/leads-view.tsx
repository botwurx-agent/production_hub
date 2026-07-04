"use client";

import { useState } from "react";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadList } from "@/components/leads/lead-list";
import type { LeadRow } from "@/components/leads/types";

type View = "board" | "list";

export function LeadsView({ leads }: { leads: LeadRow[] }) {
  const [view, setView] = useState<View>("board");

  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
        {(["board", "list"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              view === v
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      {view === "board" ? (
        <LeadBoard leads={leads} />
      ) : (
        <LeadList leads={leads} />
      )}
    </div>
  );
}
