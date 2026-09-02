"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { addCallSheetEntriesFromRoster } from "@/app/(app)/projects/[id]/callsheet-actions";
import {
  importChoices,
  defaultPicks,
  contactLine,
  type EntryKind,
  type ExistingEntry,
  type RosterContact,
} from "@/lib/callsheet-import";

/**
 * Fill a call sheet section from the project roster.
 *
 * EVERYONE MISSING IS PRE-TICKED, because the answer is almost always "all of
 * them": the producer typed this roster for this job. Somebody who is already
 * on the sheet is still listed, greyed, and marked, so the list reads as the
 * whole crew rather than as a mysteriously short one.
 */
export function RosterImportButton({
  projectId,
  callSheetId,
  kind,
  roster,
  entries,
  label,
}: {
  projectId: string;
  callSheetId: string;
  kind: EntryKind;
  roster: RosterContact[];
  entries: ExistingEntry[];
  /** What this section is called, for the modal heading. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const choices = useMemo(
    () => importChoices(roster, entries, kind),
    [roster, entries, kind]
  );
  const [picked, setPicked] = useState<string[]>([]);

  // Nothing on the roster belongs in this section, so the control would only
  // ever open an empty window.
  if (choices.length === 0) return null;

  const available = choices.filter((c) => !c.onSheet);

  function openPicker() {
    setPicked(defaultPicks(choices));
    setOpen(true);
  }

  function add() {
    start(async () => {
      const res = await addCallSheetEntriesFromRoster(projectId, callSheetId, picked);
      if (res?.error) {
        toast(res.error);
        return;
      }
      const n = res?.added ?? 0;
      toast(n === 0 ? "Nobody new to add." : `Added ${n} to ${label.toLowerCase()}.`);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={openPicker}
        className="rounded-[8px] border border-border px-2 py-0.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text print:hidden"
      >
        + From roster
        {available.length > 0 && (
          <span className="ml-1 text-text-faint">({available.length})</span>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Add to ${label.toLowerCase()}`}
        size="md"
      >
        <p className="mb-3 text-sm text-text-muted">
          From this project&apos;s contacts. Call times stay blank for you to fill in.
        </p>
        <div className="max-h-[50vh] space-y-1 overflow-auto">
          {choices.map(({ contact: c, onSheet }) => {
            const line = contactLine(c);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 transition ${
                  onSheet
                    ? "cursor-default border-border bg-surface-2 opacity-60"
                    : "cursor-pointer border-border hover:bg-surface-2"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={onSheet}
                  checked={onSheet || picked.includes(c.id)}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)
                    )
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">
                    {c.name}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {[c.role?.trim(), line].filter(Boolean).join(" · ") || "No role or contact"}
                  </span>
                </span>
                {onSheet && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-text-faint">
                    On the sheet
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-[10px] px-3 py-2 text-sm font-semibold text-text-muted transition hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={add}
            disabled={busy || picked.length === 0}
            className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
          >
            {busy
              ? "Adding…"
              : `Add ${picked.length} ${picked.length === 1 ? "person" : "people"}`}
          </button>
        </div>
      </Modal>
    </>
  );
}
