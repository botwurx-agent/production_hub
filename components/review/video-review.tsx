"use client";

import { useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { PortalComment } from "@/lib/review-links";

function fmt(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Frame.io-style video review: comments are tied to a timecode on the timeline.
// Capture the playhead, comment, and each comment seeks the video when clicked.
export function VideoReview({
  videoUrl,
  comments,
  canResolve = true,
  disabled = false,
  disabledHint,
  wide = false,
  onPost,
  onResolve,
}: {
  videoUrl: string;
  comments: PortalComment[];
  canResolve?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  // Full-page reviews (e.g. the master cut) get a taller stage + roomier
  // comment rail; the compact default suits the in-modal review.
  wide?: boolean;
  onPost: (text: string, timecode: number) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const timed = comments.filter((c) => !c.resolved && c.timecode != null);
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const visible = comments
    .filter((c) => showResolved || !c.resolved)
    .slice()
    .sort((a, b) => (a.timecode ?? 1e9) - (b.timecode ?? 1e9));

  function captureHere() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPending(Math.round(v.currentTime * 10) / 10);
  }

  function seekTo(t: number | null, id: string) {
    const v = videoRef.current;
    if (v && t != null) {
      v.currentTime = t;
      v.pause();
    }
    setActiveId(id);
  }

  async function post() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    const at = pending ?? currentTime;
    setSending(true);
    const ok = await onPost(t, at);
    setSending(false);
    if (ok) {
      setText("");
      setPending(null);
    }
  }

  return (
    <div className={`grid grid-cols-1 gap-4 ${wide ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-[1fr_340px]"}`}>
      {/* Stage */}
      <div className="rounded-[16px] p-4" style={{ backgroundColor: "#141118" }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
          className={`mx-auto w-full rounded-[10px] shadow-2xl ${wide ? "max-h-[80vh]" : "max-h-[60vh]"}`}
        />

        {/* Timeline with comment markers */}
        <div className="mt-3">
          <div className="relative h-2.5 w-full rounded-pill bg-white/15">
            <div
              className="absolute inset-y-0 left-0 rounded-pill"
              style={{
                width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                backgroundColor: "var(--accent)",
              }}
            />
            {duration > 0 &&
              timed.map((c) => (
                <button
                  key={c.id}
                  onClick={() => seekTo(c.timecode, c.id)}
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                  style={{ left: `${((c.timecode as number) / duration) * 100}%` }}
                  title={`${fmt(c.timecode)} — ${c.author}`}
                  aria-label={`Comment at ${fmt(c.timecode)}`}
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
                    style={{
                      backgroundColor: activeId === c.id ? "var(--h-amber)" : "var(--accent)",
                    }}
                  >
                    {c.pinNumber ?? "•"}
                  </span>
                </button>
              ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-semibold text-white/60">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
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
                  <path d="m10 8 6 4-6 4V8z" />
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-text">No comments yet</p>
              <p className="mt-1 text-xs text-text-muted">
                Pause where you want feedback and add a comment at that moment.
              </p>
            </div>
          ) : (
            visible.map((c) => (
              <div
                key={c.id}
                onClick={() => seekTo(c.timecode, c.id)}
                className={`flex cursor-pointer gap-2.5 border-l-[3px] px-4 py-3 transition ${
                  activeId === c.id
                    ? "border-accent bg-accent-soft/50"
                    : "border-transparent hover:bg-surface-2/60"
                } ${c.resolved ? "opacity-55" : ""}`}
              >
                {c.timecode != null ? (
                  <span
                    className="mt-0.5 shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white"
                    style={{ backgroundColor: c.resolved ? "var(--border-strong)" : "var(--accent)" }}
                  >
                    {fmt(c.timecode)}
                  </span>
                ) : (
                  <span className="mt-0.5 h-5 w-10 shrink-0" />
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
          ) : (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-bold"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                at {fmt(pending ?? currentTime)}
              </span>
              <button
                onClick={captureHere}
                className="text-[11px] font-semibold text-text-muted transition hover:text-text"
              >
                Pin to current frame
              </button>
            </div>
          )}
          <textarea
            value={text}
            onFocus={() => {
              if (pending == null) captureHere();
            }}
            onChange={(e) => setText(e.target.value)}
            placeholder="Comment at this moment…"
            className="min-h-[64px] w-full rounded-[11px] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center justify-end">
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
