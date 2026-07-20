"use client";

import { useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { PortalComment } from "@/lib/review-links";

// Approx one frame at 24fps. We don't know the true fps from an <video>, so frame
// stepping nudges by this; combined with the decimal readout it's precise enough
// to land on a specific moment.
const FRAME = 1 / 24;

// Timecode with hundredths so a reviewer can pin an exact frame (e.g. 0:07.17).
function fmt(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "0:00.00";
  const total = Math.max(0, Math.round(s * 100) / 100);
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
}

// Frame.io-style video review: comments are tied to a precise timecode. A real
// draggable scrubber (click / drag to seek accurately), frame stepping, and
// click-a-comment-to-jump.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
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

  const round2 = (t: number) => Math.round(t * 100) / 100;
  const pct = duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%";

  function seekAbsolute(t: number) {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.min(duration || t, Math.max(0, t));
    v.currentTime = clamped;
    setCurrentTime(round2(clamped));
  }
  function timeFromClientX(x: number): number {
    const el = barRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (x - r.left) / r.width));
    return round2(ratio * duration);
  }
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }
  function frameStep(dir: number) {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    seekAbsolute((v.currentTime ?? 0) + dir * FRAME);
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }

  function seekTo(t: number | null, id: string) {
    if (t != null) seekAbsolute(t);
    videoRef.current?.pause();
    setActiveId(id);
  }

  // Drag-to-scrub: continuous seek while the pointer is down anywhere.
  useEffect(() => {
    if (!scrubbing) return;
    function move(e: PointerEvent) {
      seekAbsolute(timeFromClientX(e.clientX));
    }
    function up() {
      setScrubbing(false);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, duration]);

  function onScrubDown(e: React.PointerEvent) {
    if (!duration) return;
    setScrubbing(true);
    seekAbsolute(timeFromClientX(e.clientX));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seekAbsolute((videoRef.current?.currentTime ?? 0) - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seekAbsolute((videoRef.current?.currentTime ?? 0) + 1); }
    else if (e.key === ",") { e.preventDefault(); frameStep(-1); }
    else if (e.key === ".") { e.preventDefault(); frameStep(1); }
  }

  function captureHere() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setPending(round2(v.currentTime));
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

  const ctrlBtn =
    "grid h-8 w-8 place-items-center rounded-[8px] text-white/80 transition hover:bg-white/10 hover:text-white";

  return (
    <div className={`grid grid-cols-1 gap-4 ${wide ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-[1fr_340px]"}`}>
      {/* Stage */}
      <div className="rounded-[16px] p-3" style={{ backgroundColor: "#141118" }}>
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={onKey}
          className="relative overflow-hidden rounded-[10px] bg-black outline-none"
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={(e) => { if (!scrubbing) setCurrentTime(round2(e.currentTarget.currentTime || 0)); }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={togglePlay}
            className={`mx-auto block w-full object-contain ${wide ? "max-h-[78vh]" : "max-h-[58vh]"}`}
          />
          {!playing && (
            <button
              onClick={togglePlay}
              aria-label="Play"
              className="absolute inset-0 grid place-items-center"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </button>
          )}
        </div>

        {/* Scrubber */}
        <div className="mt-3">
          <div
            ref={barRef}
            onPointerDown={onScrubDown}
            className="relative h-3 w-full cursor-pointer rounded-pill bg-white/15"
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-pill"
              style={{ width: pct, backgroundColor: "var(--accent)" }}
            />
            {/* comment markers */}
            {duration > 0 &&
              timed.map((c) => (
                <button
                  key={c.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => seekTo(c.timecode, c.id)}
                  className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                  style={{ left: `${((c.timecode as number) / duration) * 100}%` }}
                  title={`${fmt(c.timecode)} — ${c.author}`}
                  aria-label={`Comment at ${fmt(c.timecode)}`}
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
                    style={{ backgroundColor: activeId === c.id ? "var(--h-amber)" : "var(--accent)" }}
                  >
                    {c.pinNumber ?? "•"}
                  </span>
                </button>
              ))}
            {/* playhead handle */}
            <div
              className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-black/30"
              style={{ left: pct }}
            />
          </div>

          {/* controls */}
          <div className="mt-2 flex items-center gap-1">
            <button onClick={togglePlay} className={ctrlBtn} aria-label={playing ? "Pause" : "Play"}>
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={() => frameStep(-1)} className={ctrlBtn} title="Previous frame ( , )" aria-label="Previous frame">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 20 9 12l10-8z" /><line x1="5" y1="19" x2="5" y2="5" /></svg>
            </button>
            <button onClick={() => frameStep(1)} className={ctrlBtn} title="Next frame ( . )" aria-label="Next frame">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 4 10 8-10 8z" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
            </button>
            <span className="ml-1 tabular-nums text-xs font-bold text-white">{fmt(currentTime)}</span>
            <span className="tabular-nums text-xs text-white/40">/ {fmt(duration)}</span>
            <span className="flex-1" />
            <button onClick={toggleMute} className={ctrlBtn} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
              )}
            </button>
            <button onClick={toggleFullscreen} className={ctrlBtn} aria-label="Fullscreen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            </button>
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
