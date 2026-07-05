"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ShotBoardEditor, type CardView } from "@/components/production/shot-board-editor";
import { CallSheet } from "@/components/production/call-sheet";
import { BudgetTable } from "@/components/production/budget-table";
import type {
  CallSheet as CS,
  CallSheetEntry,
  ShotBoard,
  ShotBoardFlavor,
  ShotGroup,
  BudgetLine,
} from "@/lib/database.types";

type Tab = "board" | "callsheet" | "budget" | "gear" | "delivery";

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "board", label: "Shot board" },
  { key: "callsheet", label: "Call sheet" },
  { key: "budget", label: "Budget" },
  { key: "gear", label: "Gear & crew", soon: true },
  { key: "delivery", label: "Delivery", soon: true },
];

export function ProductionTabs({
  projectId,
  projectTitle,
  board,
  flavors,
  groups,
  cards,
  callSheet,
  entries,
  budgetLines,
}: {
  projectId: string;
  projectTitle: string;
  board: ShotBoard | null;
  flavors: ShotBoardFlavor[];
  groups: ShotGroup[];
  cards: CardView[];
  callSheet: CS | null;
  entries: CallSheetEntry[];
  budgetLines: BudgetLine[];
}) {
  const [tab, setTab] = useState<Tab>("board");

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
        {tab === "board" && (
          <ShotBoardEditor
            projectId={projectId}
            projectTitle={projectTitle}
            board={board}
            flavors={flavors}
            groups={groups}
            cards={cards}
          />
        )}
        {tab === "callsheet" && (
          <CallSheet
            projectId={projectId}
            projectTitle={projectTitle}
            callSheet={callSheet}
            entries={entries}
          />
        )}
        {tab === "budget" && (
          <BudgetTable projectId={projectId} lines={budgetLines} />
        )}
      </Card>
    </div>
  );
}
