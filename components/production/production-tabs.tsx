"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ShotList } from "@/components/production/shot-list";
import { CallSheet } from "@/components/production/call-sheet";
import type { Shot, CallSheet as CS, CallSheetEntry } from "@/lib/database.types";

type Tab = "shots" | "callsheet" | "budget" | "gear" | "delivery";

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "shots", label: "Shot list" },
  { key: "callsheet", label: "Call sheet" },
  { key: "budget", label: "Budget", soon: true },
  { key: "gear", label: "Gear & crew", soon: true },
  { key: "delivery", label: "Delivery", soon: true },
];

export function ProductionTabs({
  projectId,
  projectTitle,
  shots,
  callSheet,
  entries,
}: {
  projectId: string;
  projectTitle: string;
  shots: Shot[];
  callSheet: CS | null;
  entries: CallSheetEntry[];
}) {
  const [tab, setTab] = useState<Tab>("shots");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => !t.soon && setTab(t.key)}
            disabled={t.soon}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-accent-soft text-accent"
                : t.soon
                  ? "cursor-default text-text-faint/60"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t.label}
            {t.soon && (
              <span className="ml-1.5 rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-text-faint">
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="p-5">
        {tab === "shots" && <ShotList projectId={projectId} shots={shots} />}
        {tab === "callsheet" && (
          <CallSheet
            projectId={projectId}
            projectTitle={projectTitle}
            callSheet={callSheet}
            entries={entries}
          />
        )}
      </Card>
    </div>
  );
}
