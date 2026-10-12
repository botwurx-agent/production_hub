"use client";

// Send Scene builder cameras to a shot list: one row per camera, carrying the
// frame it sees, the shot size, the angle and the movement in the shot list's
// own words, and the lens and support as a notes line. A camera whose code is
// already on the chosen list updates that row; the window says which before
// anything is sent, since an update replaces the row's picture.
import { useMemo, useState } from "react";
import Link from "next/link";
import { normCode } from "@/lib/previz/shot-export";

export type SendCamera = {
  id: string;
  code: string;
  title: string;
  shotSize: string;
  shotType: string;
  movement: string;
  notesLine: string;
  thumb: string | null;
};

export type SendTarget = { listId: string | null; newTitle: string | null };

export type SendResult =
  | { listId: string; title: string; added: number; updated: number; unpictured: string[] }
  | { error: string };

export function SendToShotListDialog({
  cameras,
  lists,
  defaultTitle,
  shotListHref,
  onSend,
  onClose,
}: {
  cameras: SendCamera[];
  lists: { id: string; title: string; codes: string[] }[];
  defaultTitle: string;
  shotListHref: string;
  onSend: (ids: string[], target: SendTarget) => Promise<SendResult>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "new");
  const [newTitle, setNewTitle] = useState(defaultTitle || "Shot list");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(cameras.map((c) => c.id)));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const codes = useMemo(() => {
    const l = lists.find((x) => x.id === target);
    return new Set((l?.codes ?? []).map(normCode));
  }, [lists, target]);

  const chosen = cameras.filter((c) => picked.has(c.id));
  const updates = chosen.filter((c) => codes.has(normCode(c.code))).length;
  const adds = chosen.length - updates;

  const send = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await onSend(
          chosen.map((c) => c.id),
          target === "new" ? { listId: null, newTitle: newTitle.trim() || "Shot list" } : { listId: target, newTitle: null },
        ),
      );
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Could not send to the shot list." });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onClose} data-previz-own-wheel>
      <div
        role="dialog"
        aria-label="Send to shot list"
        className="max-h-[90vh] w-[640px] max-w-full overflow-y-auto rounded-[16px] border border-border bg-surface p-5 text-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Send to shot list</h2>
            <p className="text-xs text-text-muted">
              Each camera becomes a row: the frame it sees, its shot size, angle and movement, and the lens and what it
              is on in the notes. A camera whose code is already on the list updates that row instead.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-xs font-semibold text-text-muted hover:text-text disabled:opacity-50">
            Close
          </button>
        </div>

        {result && "listId" in result ? (
          <div className="space-y-3">
            <div className="rounded-[10px] border border-[var(--h-green)] bg-[var(--h-green-bg)] p-3 text-text">
              <p className="font-semibold">
                {[
                  result.added ? `${result.added} ${result.added === 1 ? "row" : "rows"} added` : null,
                  result.updated ? `${result.updated} updated` : null,
                ].filter(Boolean).join(", ")}{" "}
                on {result.title}.
              </p>
              {result.unpictured.length ? (
                <p className="mt-1 text-xs">
                  The frame for {result.unpictured.join(", ")} could not be stored, so {result.unpictured.length === 1 ? "that row has" : "those rows have"} no picture. Send again to retry.
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold">
                Done
              </button>
              <Link href={shotListHref} className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
                Open the shot list
              </Link>
            </div>
          </div>
        ) : (
          <>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-text-muted">Shot list</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
              >
                {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                <option value="new">New shot list...</option>
              </select>
            </label>
            {target === "new" ? (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-text-muted">Name</span>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text"
                />
              </label>
            ) : null}

            <div className="mb-3 space-y-1.5">
              {cameras.map((c) => {
                const on = picked.has(c.id);
                const update = codes.has(normCode(c.code));
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-[10px] border p-2 ${on ? "border-border-strong" : "border-border opacity-60"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                    <div className="h-[45px] w-[80px] shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                      {c.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.thumb} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{c.code}</span>
                        <span className="truncate text-xs text-text-muted">{c.title}</span>
                      </div>
                      <div className="text-[11px] text-text-muted">{c.shotSize} · {c.shotType} · {c.movement}</div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-text-muted">
                      {target !== "new" && update ? `Updates ${c.code}` : `Adds ${c.code}`}
                    </span>
                  </label>
                );
              })}
            </div>

            {updates ? (
              <p className="mb-3 text-xs text-text-muted">
                Updating a row replaces its picture, size, angle and movement. Its description and your own notes are kept.
              </p>
            ) : null}
            {result && "error" in result ? (
              <p className="mb-3 rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] p-2 text-xs text-text">{result.error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !chosen.length}
                className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {busy
                  ? "Sending..."
                  : `Send ${chosen.length} ${chosen.length === 1 ? "camera" : "cameras"}${adds && updates ? ` (${adds} new, ${updates} updated)` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
