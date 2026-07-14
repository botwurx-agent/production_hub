"use client";

import { useMemo, useState } from "react";
import { DealBoard } from "@/components/deals/deal-board";
import { DealList } from "@/components/deals/deal-list";
import { money } from "@/lib/format";
import { DEAL_OPEN_STAGES } from "@/lib/status";
import type { DealRow } from "@/components/deals/types";

type View = "board" | "list";
type Owner = "everyone" | "mine";

export function DealsView({
  deals,
  currentUserId,
}: {
  deals: DealRow[];
  currentUserId: string;
}) {
  const [view, setView] = useState<View>("board");
  const [owner, setOwner] = useState<Owner>("everyone");

  const filtered = useMemo(
    () =>
      owner === "mine"
        ? deals.filter((d) => d.owner_id === currentUserId)
        : deals,
    [deals, owner, currentUserId]
  );

  // Weighted-free open pipeline value (a simple, honest total of in-play deals).
  const openValue = filtered
    .filter((d) => DEAL_OPEN_STAGES.includes(d.stage))
    .reduce((t, d) => t + (d.value ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
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
        <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
          {(["everyone", "mine"] as Owner[]).map((o) => (
            <button
              key={o}
              onClick={() => setOwner(o)}
              className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                owner === o
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {o === "mine" ? "Mine" : "Everyone"}
            </button>
          ))}
        </div>
        {openValue > 0 && (
          <span className="ml-auto text-sm text-text-muted">
            Open pipeline{" "}
            <span className="font-bold text-text">{money(openValue)}</span>
          </span>
        )}
      </div>
      {view === "board" ? (
        <DealBoard deals={filtered} />
      ) : (
        <DealList deals={filtered} />
      )}
    </div>
  );
}
