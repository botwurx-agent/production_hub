"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CallSheet } from "@/components/production/call-sheet";
import { BudgetTable } from "@/components/production/budget-table";
import { GearList } from "@/components/production/gear-list";
import { DeliveryPanel } from "@/components/production/delivery-panel";
import type {
  CallSheet as CS,
  CallSheetEntry,
  BudgetLine,
  GearItem,
  Deliverable,
  ProjectBilling,
} from "@/lib/database.types";

type Tab = "callsheet" | "budget" | "gear" | "delivery";

const TABS: { key: Tab; label: string; soon?: boolean }[] = [
  { key: "callsheet", label: "Call sheet" },
  { key: "budget", label: "Budget" },
  { key: "gear", label: "Gear & crew" },
  { key: "delivery", label: "Delivery" },
];

export function ProductionTabs({
  projectId,
  projectTitle,
  callSheet,
  entries,
  budgetLines,
  gearItems,
  deliverables,
  billing,
  initialTab = "callsheet",
}: {
  projectId: string;
  projectTitle: string;
  callSheet: CS | null;
  entries: CallSheetEntry[];
  budgetLines: BudgetLine[];
  gearItems: GearItem[];
  deliverables: Deliverable[];
  billing: ProjectBilling | null;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

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
        {tab === "gear" && <GearList projectId={projectId} items={gearItems} />}
        {tab === "delivery" && (
          <DeliveryPanel
            projectId={projectId}
            deliverables={deliverables}
            billing={billing}
          />
        )}
      </Card>
    </div>
  );
}
