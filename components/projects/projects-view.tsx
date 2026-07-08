"use client";

import { useState } from "react";
import { ProjectBoard } from "@/components/projects/project-board";
import { ProjectList } from "@/components/projects/project-list";
import type { ProjectRow } from "@/components/projects/types";

type View = "board" | "list";

export function ProjectsView({ projects }: { projects: ProjectRow[] }) {
  const [view, setView] = useState<View>("board");
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = projects.filter((p) => p.archived).length;
  const visible = showArchived
    ? projects.filter((p) => p.archived)
    : projects.filter((p) => !p.archived);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
              showArchived
                ? "border-transparent bg-accent-soft text-accent"
                : "border-border text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
            </svg>
            {showArchived ? "Back to active" : `Archived (${archivedCount})`}
          </button>
        )}
      </div>

      {showArchived && (
        <p className="mb-3 text-xs text-text-muted">
          Archived projects are hidden from your active board and the dashboard.
          Open one and hit Unarchive to bring it back.
        </p>
      )}

      {view === "board" ? (
        <ProjectBoard projects={visible} />
      ) : (
        <ProjectList projects={visible} />
      )}
    </div>
  );
}
