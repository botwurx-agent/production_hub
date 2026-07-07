"use client";

import { useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { PortalComment } from "@/lib/review-links";

// Frame.io-style pinned review: click the image to drop the next numbered pin
// and open a matching comment; the sidebar stays in sync. Context-agnostic:
// the parent supplies the post/resolve handlers (authenticated app or portal).
export function PinReview({
  imageUrl,
  alt,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  onPost,
  onResolve,
}: {
  imageUrl: string;
  alt: string;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onPost: (text: string, pin: { x: number; y: number } | null) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const pins = comments.filter(
    (c) => !c.resolved && c.x != null && c.y != null && c.pinNumber != null
  );
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const visible = comments.filter((c) => showResolved || !c.resolved);
  // The number the next pin will get, shown live on the pending marker.
  const nextPin =
    comments.reduce((m, c) => (c.pinNumber && c.pinNumber > m ? c.pinNumber : m), 0) + 1;

  function placePin(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPending({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setActiveId(null);
  }

  async function post() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    setSending(true);
    const ok = await onPost(t, pending);
    setSending(false);
    if (ok) {
      setText("");
      setPending(null);
    }
  }

  const teardrop =
    "grid h-7 w-7 place-items-center rounded-[50%_50%_50%_2px] border-2 border-white text-xs font-extrabold text-white shadow-lg";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      {/* Stage — a stable dark viewing environment for judging the work */}
      <div
        className="flex items-center justify-center rounded-[16px] p-4"
        style={{ backgroundColor: "#141118" }}
      >
        <div
          ref={wrapRef}
          onClick={placePin}
          className="relative inline-block cursor-crosshair"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="block max-h-[66vh] w-auto max-w-full rounded-[10px] object-contain shadow-2xl"
            draggable={false}
          />

          {pins.map((c) => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(c.id);
                setPending(null);
              }}
              className="absolute z-10 transition-transform hover:scale-110"
              style={{ left: `${c.x}%`, top: `${c.y}%`, transform: "translate(-50%,-100%)" }}
              aria-label={`Comment ${c.pinNumber}`}
            >
              <span
                className={teardrop}
                style={{
                  backgroundColor: "var(--accent)",
                  transform: "rotate(45deg)",
                  outline: activeId === c.id ? "3px solid var(--accent-soft)" : "none",
                }}
              >
                <span style={{ transform: "rotate(-45deg)" }}>{c.pinNumber}</span>
              </span>
            </button>
          ))}

          {pending && (
            <span
              className="absolute z-10 animate-pulse"
              style={{ left: `${pending.x}%`, top: `${pending.y}%`, transform: "translate(-50%,-100%)" }}
            >
              <span
                className={teardrop}
                style={{ backgroundColor: "var(--h-amber)", transform: "rotate(45deg)" }}
              >
                <span style={{ transform: "rotate(-45deg)" }}>{nextPin}</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="flex min-h-[320px] flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-text">Comments</span>
            <span
              className="rounded-pill px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {comments.length}
            </span>
          </div>
          {resolvedCount > 0 && (
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div
                className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-[13px]"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-text">No comments yet</p>
              <p className="mt-1 text-xs text-text-muted">
                Click anywhere on the image to drop a pin and start.
              </p>
            </div>
          ) : (
            visible.map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex cursor-pointer gap-2.5 border-l-[3px] px-4 py-3 transition ${
                  activeId === c.id
                    ? "border-accent bg-accent-soft/50"
                    : "border-transparent hover:bg-surface-2/60"
                } ${c.resolved ? "opacity-55" : ""}`}
              >
                {c.pinNumber != null ? (
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: c.resolved ? "var(--border-strong)" : "var(--accent)" }}
                  >
                    {c.pinNumber}
                  </span>
                ) : (
                  <span className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold text-text">{c.author}</span>
                    <span
                      className="rounded-pill px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={
                        c.isClient
                          ? { backgroundColor: "var(--h-cyan)", color: "#fff" }
                          : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }
                      }
                    >
                      {c.isClient ? "Client" : "Studio"}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold text-text-faint">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-text-muted">
                    {c.body}
                  </p>
                  {canResolve && onResolve && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResolve(c.id, !c.resolved);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-text-faint transition hover:text-green"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      {c.resolved ? "Resolved · undo" : "Resolve"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {disabled && disabledHint ? (
            <p
              className="mb-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
              style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
            >
              {disabledHint}
            </p>
          ) : pending ? (
            <p className="mb-2 text-[11.5px] font-bold" style={{ color: "var(--h-amber)" }}>
              📍 Pin {nextPin} placed — write your note
            </p>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={pending ? "Comment on this spot…" : "Add a comment, or click the image to pin one…"}
            className="min-h-[64px] w-full rounded-[11px] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {pending ? (
              <button
                onClick={() => setPending(null)}
                className="text-xs font-semibold text-text-faint hover:text-text"
              >
                Clear pin
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={post}
              disabled={disabled || sending || !text.trim()}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
            >
              {sending ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
