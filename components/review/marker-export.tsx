"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useTeamReview } from "@/components/review/team-review";
import type { PortalComment } from "@/lib/review-links";
import {
  FRAME_RATES,
  MARKER_FORMATS,
  buildMarkers,
  defaultStartHour,
  frameRate,
  markerFileName,
  type MarkerFormat,
  type MarkerNote,
} from "@/lib/marker-export";

const PREF_KEY = "review.markerExport";

type Prefs = { format: MarkerFormat; rate: string; includeResolved: boolean };

function readPrefs(): Prefs {
  const fallback: Prefs = { format: "premiere", rate: "24", includeResolved: false };
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      format: MARKER_FORMATS.some((f) => f.key === p.format) ? (p.format as MarkerFormat) : fallback.format,
      rate: FRAME_RATES.some((r) => r.key === p.rate) ? (p.rate as string) : fallback.rate,
      includeResolved: p.includeResolved === true,
    };
  } catch {
    return fallback;
  }
}

/** Comments with a moment, replies folded under their parent. */
export function toMarkerNotes(comments: PortalComment[], includeResolved: boolean): MarkerNote[] {
  const replies = new Map<string, PortalComment[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const list = replies.get(c.parentId) ?? [];
    list.push(c);
    replies.set(c.parentId, list);
  }
  return comments
    .filter((c) => !c.parentId && c.timecode != null && (includeResolved || !c.resolved))
    .map((c) => ({
      number: c.pinNumber,
      author: c.author,
      isClient: c.isClient,
      teamOnly: Boolean(c.teamOnly),
      resolved: c.resolved,
      timecode: c.timecode as number,
      timecodeEnd: c.timecodeEnd,
      body: c.body,
      replies: (replies.get(c.id) ?? []).map((r) => ({ author: r.author, body: r.body })),
    }));
}

/**
 * "Send to editor" on a video review: the notes as timeline markers for
 * Premiere, Resolve or Final Cut, or a CSV.
 *
 * TEAM ONLY, through the same context as the Team only switch: the export
 * carries team-only notes (the editor is the team), so it must never appear on
 * the client's review link, which lives outside the provider.
 */
export function MarkerExportButton({
  comments,
  title,
  className,
}: {
  comments: PortalComment[];
  title: string;
  className?: string;
}) {
  const team = useTeamReview();
  const [open, setOpen] = useState(false);
  if (!team) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className}
        title="Download the notes as markers for the edit"
        aria-label="Export notes as timeline markers"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3v18" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
        <span className="text-[11px] font-bold">Markers</span>
      </button>
      {open && (
        <MarkerExportModal comments={comments} title={title} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function MarkerExportModal({
  comments,
  title,
  onClose,
}: {
  comments: PortalComment[];
  title: string;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [startHour, setStartHour] = useState<0 | 1>(defaultStartHour(prefs.format));

  const notes = useMemo(
    () => toMarkerNotes(comments, prefs.includeResolved),
    [comments, prefs.includeResolved]
  );
  const resolvedCount = useMemo(
    () => comments.filter((c) => !c.parentId && c.timecode != null && c.resolved).length,
    [comments]
  );
  const fmt = MARKER_FORMATS.find((f) => f.key === prefs.format) ?? MARKER_FORMATS[0];

  function update(next: Partial<Prefs>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    if (next.format) setStartHour(defaultStartHour(next.format));
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(merged));
    } catch {
      /* a preference, not data */
    }
  }

  function download() {
    const text = buildMarkers(notes, {
      format: prefs.format,
      rate: frameRate(prefs.rate),
      startHour,
      title,
    });
    const type = prefs.format === "csv" ? "text/csv" : "text/plain";
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = markerFileName(title, prefs.format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  }

  const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-text-muted";
  const chip = (on: boolean) =>
    `rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
      on ? "border-accent bg-accent-soft text-text" : "border-border text-text-muted hover:text-text"
    }`;

  return (
    <Modal open onClose={onClose} title="Send notes to the edit">
      <div className="space-y-5">
        <p className="text-[13.5px] text-text-muted">
          Every note lands on its frame in the editor&apos;s timeline. Team-only notes are
          included; this file is for your editor, not the client.
        </p>

        <div>
          <span className={label}>Editing app</span>
          <div className="flex flex-wrap gap-1.5">
            {MARKER_FORMATS.map((f) => (
              <button key={f.key} onClick={() => update({ format: f.key })} className={chip(prefs.format === f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-text-muted">{fmt.hint}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Sequence frame rate</span>
            <select
              value={prefs.rate}
              onChange={(e) => update({ rate: e.target.value })}
              className="w-full rounded-[10px] border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none focus:border-accent"
            >
              {FRAME_RATES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label} fps
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11.5px] text-text-muted">Match the editor&apos;s sequence.</span>
          </label>
          <div>
            <span className={label}>Timeline starts at</span>
            <div className="flex flex-wrap gap-1.5">
              {([0, 1] as const).map((h) => (
                <button key={h} onClick={() => setStartHour(h)} className={chip(startHour === h)}>
                  {h === 0 ? "00:00:00:00" : "01:00:00:00"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {resolvedCount > 0 && (
          <label className="flex items-center gap-2 text-[13px] text-text">
            <input
              type="checkbox"
              checked={prefs.includeResolved}
              onChange={(e) => update({ includeResolved: e.target.checked })}
            />
            Include {resolvedCount} resolved {resolvedCount === 1 ? "note" : "notes"}
          </label>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-[13px] text-text-muted">
            {notes.length === 0
              ? "No open notes with a timecode yet."
              : `${notes.length} ${notes.length === 1 ? "marker" : "markers"}`}
          </span>
          <button
            onClick={download}
            disabled={notes.length === 0}
            className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
          >
            Download {fmt.ext.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}
