"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Are you sure, asked properly.
//
// Same module-level pub/sub as the toast, so any client code can await
// confirmAction(...) without threading a provider, and <ConfirmHost/> is
// mounted once in the app shell. The alternative already in the codebase is
// window.confirm, which works but arrives as an unstyled browser chrome box
// that names the site rather than the thing being deleted, and which some
// browsers let a page suppress entirely.
//
// Reserved for what cannot be taken back. A delete the editor's undo already
// covers should NOT ask: a prompt on a reversible action trains people to
// dismiss prompts, which is what makes the irreversible one dangerous.

export type ConfirmRequest = {
  title: string;
  /** What will happen, in the operator's terms. State what is lost. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button. On by default, since this exists for destructive things. */
  destructive?: boolean;
};

type Pending = ConfirmRequest & { id: number; resolve: (ok: boolean) => void };

const listeners = new Set<(p: Pending) => void>();
let nextId = 1;

export function confirmAction(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const pending: Pending = { ...req, id: nextId++, resolve };
    if (listeners.size === 0) {
      // No host mounted (a print view, a test). Falling back to the browser's
      // own dialog keeps the guard rather than silently letting the delete
      // through, which would be the one failure mode that matters here.
      resolve(
        typeof window === "undefined"
          ? false
          : window.confirm([req.title, req.body].filter(Boolean).join("\n\n"))
      );
      return;
    }
    listeners.forEach((fn) => fn(pending));
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const onAsk = (p: Pending) => setPending(p);
    listeners.add(onAsk);
    return () => {
      listeners.delete(onAsk);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") answer(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // answer is stable for the life of one pending request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function answer(ok: boolean) {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  }

  if (!pending) return null;
  if (typeof document === "undefined") return null;

  const destructive = pending.destructive ?? true;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={pending.title}
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => answer(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-[18px] border border-border bg-surface p-5 shadow-lg">
        <h2 className="font-display text-base font-bold text-text">
          {pending.title}
        </h2>
        {pending.body && (
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            {pending.body}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => answer(false)}
            className="rounded-[10px] border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            // Focused on mount so Enter confirms and Escape cancels, which is
            // what a keyboard reaches for.
            autoFocus
            onClick={() => answer(true)}
            className={`rounded-[10px] px-3.5 py-2 text-xs font-semibold transition ${
              destructive
                ? "bg-red text-white hover:opacity-90"
                : "bg-accent text-accent-fg hover:bg-accent-strong"
            }`}
          >
            {pending.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
