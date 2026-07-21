"use client";

import { useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import { ScrubVideo, fmtTime as fmt, type ScrubVideoHandle } from "@/components/review/video-player";
import type { PortalComment } from "@/lib/review-links";

// Frame.io-style video review: the shared ScrubVideo player (accurate scrubbing,
// decimal timecodes, frame stepping) + a comment rail. Comments pin to a precise
// timecode; clicking one jumps the player there.
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
  wide?: boolean;
  onPost: (text: string, timecode: number) => Promise<boolean>;
  onResolve?: (id: string, resolved: boolean) => void;
}) {
  const playerRef = useRef<ScrubVideoHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const round2 = (t: number) => Math.round(t * 100) / 100;
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const visible = comments
    .filter((c) => showResolved || !c.resolved)
    .slice()
    .sort((a, b) => (a.timecode ?? 1e9) - (b.timecode ?? 1e9));

  const markers = comments
    .filter((c) => !c.resolved && c.timecode != null)
    .map((c) => ({ id: c.id, timecode: c.timecode as number, number: c.pinNumber ?? "•", active: activeId === c.id }));

  function seekTo(t: number | null, id: string) {
    if (t != null) playerRef.current?.seek(t);
    playerRef.current?.pause();
    setActiveId(id);
  }
  function captureHere() {
    const t = playerRef.current?.getTime() ?? currentTime;
    playerRef.current?.pause();
    setPending(round2(t));
  }

  async function post() {
    const t = text.trim();
    if (!t || sending || disabled) return;
    const at = pending ?? round2(currentTime);
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
      <ScrubVideo
        ref={playerRef}
        src={videoUrl}
        markers={markers}
        onMarkerClick={(id) => {
          const c = comments.find((x) => x.id === id);
          seekTo(c?.timecode ?? null, id);
        }}
        onTime={setCurrentTime}
        maxHeightClass={wide ? "max-h-[78vh]" : "max-h-[58vh]"}
      />

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
                className={`flex cursor-pointer items-start gap-2.5 border-l-[3px] px-4 py-3 transition ${
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
                  <span className="mt-0.5 h-5 w-12 shrink-0" />
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
                className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-bold tabular-nums"
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
