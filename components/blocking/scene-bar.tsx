"use client";

// The scene bar: say what the shot is, or what to change, and the scene is
// laid out or changed. Lives along the bottom of the camera view. The result
// lands as ONE undoable edit, so a layout the producer does not like is a
// single Undo away; the card says what was done and what could not be read.
import { useState } from "react";
import type { Asked } from "@/lib/blocking/scene";

export type SceneBarAnswer = { summary: string; skipped: string[] } | { error: string };

export function SceneBar({
  onSubmit, onUndo, placeholder, disabled, collapsible = false, history,
}: {
  /** What was asked before on this scene, oldest first; the latest few show under the bar. */
  history?: Asked[];
  /** Folds to a small pill when idle, so it does not sit over the picture. */
  collapsible?: boolean;
  onSubmit: (prompt: string) => Promise<SceneBarAnswer>;
  onUndo?: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<SceneBarAnswer | null>(null);
  const [open, setOpen] = useState(!collapsible);

  const send = async () => {
    const ask = text.trim();
    if (!ask || busy) return;
    setBusy(true);
    setAnswer(null);
    const res = await onSubmit(ask).catch(() => ({ error: "That did not reach the server. Try again." }));
    setBusy(false);
    setAnswer(res);
    if (!("error" in res)) setText("");
  };

  if (!open && !busy && !answer && !text) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-text shadow-xl hover:border-accent disabled:opacity-50">
        <span aria-hidden className="text-amber">✦</span> Describe a change
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-full max-w-[640px]">
      {answer && (
        <div className="mb-1.5 rounded-[10px] border border-border bg-surface px-3 py-2 shadow-xl">
          <div className="flex items-start gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${"error" in answer ? "bg-red" : "bg-green"}`} />
            <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text">
              {"error" in answer ? answer.error : answer.summary}
            </p>
            {!("error" in answer) && onUndo && (
              <button type="button" onClick={() => { onUndo(); setAnswer(null); }}
                className="shrink-0 text-[11.5px] font-semibold text-text-muted hover:text-text">Undo</button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => { setAnswer(null); if (collapsible) setOpen(false); }}
              className="shrink-0 text-[13px] leading-none text-text-faint hover:text-text">×</button>
          </div>
          {!("error" in answer) && answer.skipped.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 pl-4 text-[11.5px] leading-relaxed text-text-muted">
              {answer.skipped.map((s, i) => <li key={i} className="list-disc">Left out: {s}</li>)}
            </ul>
          )}
        </div>
      )}
      {!answer && !busy && !!history?.length && (
        <div className="mb-1.5 rounded-[10px] border border-border bg-surface px-3 py-2 shadow-xl">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">Asked before</div>
          <ul className="mt-1 space-y-1">
            {history.slice(-3).reverse().map((a, i) => (
              <li key={i}>
                <button type="button" title="Use these words again" disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setText(a.text)}
                  className="block w-full text-left text-[12px] leading-snug text-text hover:text-accent">
                  <span className="line-clamp-2">{a.text}</span>
                  {a.result && <span className="mt-0.5 block line-clamp-1 text-[11px] text-text-muted">{a.result}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-center gap-1.5 rounded-[12px] border border-border-strong bg-surface p-1.5 shadow-2xl">
        <span aria-hidden className="ml-1.5 text-[13px] text-amber">✦</span>
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={disabled || busy} autoFocus={collapsible}
          onBlur={() => { if (collapsible && !text.trim() && !answer) setOpen(false); }}
          placeholder={busy ? "Laying it out…" : placeholder} maxLength={1500}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape" && collapsible) { setText(""); setOpen(false); } }}
          className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] text-text outline-none placeholder:text-text-faint disabled:opacity-60" />
        <button type="submit" disabled={disabled || busy || !text.trim()}
          className="h-8 shrink-0 rounded-[8px] bg-accent px-3 text-[12px] font-semibold text-accent-fg disabled:opacity-40">
          {busy ? "Working…" : "Go"}
        </button>
      </form>
    </div>
  );
}
