"use client";

import { useState } from "react";
import { ProjectBoard } from "@/components/projects/project-board";
import { ProjectList } from "@/components/projects/project-list";
import type { ProjectRow } from "@/components/projects/types";

type View = "board" | "list";

export function ProjectsView({ projects }: { projects: ProjectRow[] }) {
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
        <ProjectBoard projects={projects} />
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  );
}
