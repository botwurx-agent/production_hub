"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  saveCallSheet,
  addCallSheetEntry,
  updateCallSheetEntry,
  deleteCallSheetEntry,
} from "@/app/(app)/projects/[id]/production/actions";
import type { CallSheet as CS, CallSheetEntry } from "@/lib/database.types";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function CallSheet({
  projectId,
  callSheet,
  entries,
}: {
  projectId: string;
  callSheet: CS | null;
  entries: CallSheetEntry[];
}) {
  const router = useRouter();
  const [shootDate, setShootDate] = useState(callSheet?.shoot_date ?? "");
  const [callTime, setCallTime] = useState(callSheet?.call_time ?? "");
  const [location, setLocation] = useState(callSheet?.location ?? "");
  const [notes, setNotes] = useState(callSheet?.notes ?? "");

  const [rows, setRows] = useState<CallSheetEntry[]>(entries);
  const sig = entries.map((e) => e.id).join(",");
  useEffect(() => {
    setRows(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function saveHeader(patch: Parameters<typeof saveCallSheet>[1]) {
    void saveCallSheet(projectId, patch);
  }
  function editRow(id: string, patch: Partial<CallSheetEntry>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    start(async () => {
      await addCallSheetEntry(projectId);
      router.refresh();
    });
  }
  function delRow(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteCallSheetEntry(projectId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Shoot date
          </label>
          <input
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
            onBlur={() => saveHeader({ shoot_date: shootDate || null })}
            className={`mt-1.5 ${field}`}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            General call time
          </label>
          <input
            value={callTime}
            onChange={(e) => setCallTime(e.target.value)}
            onBlur={() => saveHeader({ call_time: callTime || null })}
            placeholder="e.g. 7:00 AM"
            className={`mt-1.5 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Location
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => saveHeader({ location: location || null })}
            placeholder="Address or studio"
            className={`mt-1.5 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveHeader({ notes: notes || null })}
            placeholder="Parking, weather, catering, safety..."
            className={`mt-1.5 min-h-[72px] ${field}`}
          />
        </div>
      </div>

      {/* Crew / talent */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Crew &amp; talent</h3>
          <Button size="sm" variant="secondary" onClick={addRow} disabled={busy}>
            + Person
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
            Add the people on this shoot and their call times.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-border">
            <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] gap-2 border-b border-border bg-surface-2/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
              <span>Name</span>
              <span>Role</span>
              <span>Call</span>
              <span>Contact</span>
              <span />
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-0"
              >
                <input
                  value={r.name}
                  onChange={(e) => editRow(r.id, { name: e.target.value })}
                  onBlur={() => updateCallSheetEntry(projectId, r.id, { name: r.name })}
                  placeholder="Name"
                  className={cell}
                />
                <input
                  value={r.role ?? ""}
                  onChange={(e) => editRow(r.id, { role: e.target.value })}
                  onBlur={() => updateCallSheetEntry(projectId, r.id, { role: r.role ?? "" })}
                  placeholder="Role"
                  className={cell}
                />
                <input
                  value={r.call_time ?? ""}
                  onChange={(e) => editRow(r.id, { call_time: e.target.value })}
                  onBlur={() =>
                    updateCallSheetEntry(projectId, r.id, { call_time: r.call_time ?? "" })
                  }
                  placeholder="Time"
                  className={cell}
                />
                <input
                  value={r.contact ?? ""}
                  onChange={(e) => editRow(r.id, { contact: e.target.value })}
                  onBlur={() =>
                    updateCallSheetEntry(projectId, r.id, { contact: r.contact ?? "" })
                  }
                  placeholder="Phone / email"
                  className={cell}
                />
                <button
                  onClick={() => delRow(r.id)}
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Remove person"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
