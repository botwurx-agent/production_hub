"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

export type WorkspacePhase = {
  key: string;
  label: string;
  // Quiet per-phase wayfinding hue (maps to a --h-* token). This is identity,
  // not status: it stays desaturated so it never competes with status chips.
  hue: string;
  // When set, the phase is a link to a deeper workspace instead of an in-page
  // tab (used for the Production ops workspace, which is its own route).
  href?: string;
};

export function ProjectWorkspace({
  phases,
  panels,
  rail,
}: {
  phases: WorkspacePhase[];
  // In-page panel content keyed by phase.key (server components as slots).
  panels: Record<string, ReactNode>;
  // Always-present right rail (activity + notes) that follows the job through
  // every phase.
  rail: ReactNode;
}) {
  const inPage = phases.filter((p) => !p.href);
  const [active, setActive] = useState(inPage[0]?.key ?? "");

  return (
    <div>
      {/* Phase nav: the job's lifecycle, left to right. */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
        {phases.map((p) => {
          const isActive = !p.href && p.key === active;
          const dot = (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--h-${p.hue})` }}
            />
          );
          const cls = `inline-flex items-center gap-2 rounded-pill px-3.5 py-2 text-sm font-semibold transition ${
            isActive
              ? "bg-surface-2 text-text"
              : "text-text-muted hover:bg-surface-2/60 hover:text-text"
          }`;

          if (p.href) {
            return (
              <Link key={p.key} href={p.href} className={cls}>
                {dot}
                {p.label}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-faint"
                >
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </Link>
            );
          }

          return (
            <button
              key={p.key}
              onClick={() => setActive(p.key)}
              className={cls}
            >
              {dot}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {inPage.map((p) => (
            <div key={p.key} className={p.key === active ? "" : "hidden"}>
              {panels[p.key]}
            </div>
          ))}
        </div>
        <div className="lg:col-span-1">{rail}</div>
      </div>
    </div>
  );
}
