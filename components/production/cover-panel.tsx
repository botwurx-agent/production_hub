"use client";

import { useState } from "react";
import { saveBoard } from "@/app/(app)/projects/[id]/production/board-actions";
import type { ShotBoard } from "@/lib/database.types";

/**
 * The job block every production document opens on.
 *
 * ONE set of facts per job (client, agency, director, DP, job number), stored
 * once on the project's shot_boards row and printed by ProductionCover at the
 * top of the shot list export, the storyboard export and the client binder.
 * Filling it in once is what makes all of them arrive dressed.
 *
 * EXTRACTED AND PUT ON BOTH EDITORS because it only ever lived on the shot
 * list, while the storyboard export prints the same block: somebody working in
 * storyboards could see the facts on their PDF and had nowhere at all to enter
 * them. A second copy of the form was never the answer either, for the same
 * reason ProductionCover is shared on the render side.
 *
 * IT ALSO HAD TO ANNOUNCE ITSELF. It was a quiet text button reading "Cover",
 * next to undo and redo, collapsed, on one page, and the operator who
 * specified this app could not find it. The word means nothing until you have
 * already seen the export. So the trigger now says what is inside, and an
 * unfilled block carries an amber chip: the moment it matters is exactly when
 * it is empty, and that is the moment it now speaks up.
 */

const FIELDS: [keyof ShotBoard, string][] = [
  ["client", "Client"],
  ["agency", "Agency"],
  ["production_co", "Production Co."],
  ["deliverables", "Deliverables"],
  ["director", "Director"],
  ["dp", "DP"],
  ["location", "Location"],
  ["job_no", "Job No."],
  ["shoot_days", "Shoot days"],
  ["rev_date", "Revision"],
];

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** How many of the block's fields carry something. */
export function coverFilled(board: ShotBoard | null): number {
  if (!board) return 0;
  const all: (keyof ShotBoard)[] = ["title", "subtitle", ...FIELDS.map(([k]) => k)];
  return all.filter((k) => String(board[k] ?? "").trim()).length;
}

export function CoverPanel({
  projectId,
  board,
  projectTitle,
  onSaved,
}: {
  projectId: string;
  board: ShotBoard | null;
  projectTitle: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = coverFilled(board);
  const total = FIELDS.length + 2;

  // Deliberately NOT wired into either editor's undo history. The shot list's
  // snapshot restores groups and cards, and the storyboard's restores frames,
  // so neither could put a cover field back: capturing here only added an undo
  // step that appears to do nothing.
  const save = (patch: Partial<Record<keyof ShotBoard, string | null>>) => {
    void saveBoard(projectId, patch).then(() => onSaved?.());
  };

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        Cover
        {/* Says what is inside, since "Cover" alone only means something to
            somebody who has already opened the export and wondered. */}
        <span className="hidden font-normal text-text-faint sm:inline">
          client, director, job number
        </span>
        {filled === 0 ? (
          <span
            className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
            style={{
              backgroundColor: "var(--h-amber-bg)",
              color: "var(--h-amber)",
            }}
          >
            Not filled in
          </span>
        ) : (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-text-faint">
            {filled} of {total}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-[14px] border border-border p-4">
          <p className="text-[12.5px] text-text-muted">
            These print at the top of the shot list and the storyboard when you
            present or export them. One set of facts for the whole job.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Labeled label="Title">
              <input
                defaultValue={board?.title ?? ""}
                onBlur={(e) => save({ title: e.target.value || null })}
                placeholder={projectTitle}
                className={field}
              />
            </Labeled>
            <Labeled label="Subtitle">
              <input
                defaultValue={board?.subtitle ?? ""}
                onBlur={(e) => save({ subtitle: e.target.value || null })}
                placeholder="Shot list & visual reference"
                className={field}
              />
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FIELDS.map(([key, label]) => (
              <Labeled key={key} label={label}>
                <input
                  defaultValue={(board?.[key] as string) ?? ""}
                  onBlur={(e) => save({ [key]: e.target.value || null })}
                  className={field}
                />
              </Labeled>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
