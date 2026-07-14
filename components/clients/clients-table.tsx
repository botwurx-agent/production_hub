"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusTag } from "@/components/status-tag";
import { ACCOUNT_STATUS } from "@/lib/status";
import type { AccountStatus } from "@/lib/database.types";

export type ClientRow = {
  id: string;
  name: string;
  type: "brand" | "agency";
  account_status: AccountStatus;
  contactCount: number;
  projectCount: number;
};

type Filter = "all" | "active" | "prospect" | "past";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Clients" },
  { key: "prospect", label: "Prospects" },
  { key: "past", label: "Past" },
];

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: rows.length,
      active: 0,
      prospect: 0,
      past: 0,
    };
    for (const r of rows) c[r.account_status] = (c[r.account_status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible =
    filter === "all" ? rows : rows.filter((r) => r.account_status === filter);

  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-text-faint">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 sm:table-cell">Type</th>
              <th className="hidden px-4 py-3 sm:table-cell">Contacts</th>
              <th className="hidden px-4 py-3 sm:table-cell">Projects</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const status = ACCOUNT_STATUS[c.account_status];
              return (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 transition hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-semibold text-text hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusTag hue={status.hue}>{status.label}</StatusTag>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <StatusTag hue={c.type === "agency" ? "purple" : "blue"}>
                      {c.type === "agency" ? "Agency" : "Brand"}
                    </StatusTag>
                  </td>
                  <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                    {c.contactCount}
                  </td>
                  <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                    {c.projectCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
