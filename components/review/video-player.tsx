"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Approx one frame at 24fps. We don't know the true fps from an <video>, so frame
// stepping nudges by this; with the decimal readout it's precise enough to land
// on a specific moment.
const FRAME = 1 / 24;

// Timecode with hundredths so a reviewer can pin an exact frame (e.g. 0:07.17).
export function fmtTime(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "0:00.00";
  const total = Math.max(0, Math.round(s * 100) / 100);
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
}

export type VideoMarker = {
  id: string;
  timecode: number;
  number?: string | number;
  active?: boolean;
};

export type ScrubVideoHandle = {
  seek: (t: number) => void;
  pause: () => void;
  getTime: () => number;
};

// The shared review video player: a real draggable scrubber (click / drag to seek
// accurately), decimal timecodes, prev/next-frame stepping (buttons + , / . keys),
// a playhead handle, comment markers, play/pause, mute, fullscreen, and keyboard
// control. Used everywhere a review video is shown so behavior never drifts.
export const ScrubVideo = forwardRef<ScrubVideoHandle, {
  src: string;
  markers?: VideoMarker[];
  onMarkerClick?: (id: string) => void;
  onTime?: (t: number) => void;
  maxHeightClass?: string;
  keyboard?: boolean;
  autoPlay?: boolean;
}>(function ScrubVideo(
  { src, markers = [], onMarkerClick, onTime, maxHeightClass = "max-h-[60vh]", keyboard = true, autoPlay = false },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const round2 = (t: number) => Math.round(t * 100) / 100;
  const pct = duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : "0%";

  function report(t: number) {
    setCurrentTime(t);
    onTime?.(t);
  }
  function seekAbsolute(t: number) {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.min(duration || t, Math.max(0, t));
    v.currentTime = clamped;
    report(round2(clamped));
  }

  useImperativeHandle(ref, () => ({
    seek: (t: number) => seekAbsolute(t),
    pause: () => videoRef.current?.pause(),
    getTime: () => round2(videoRef.current?.currentTime ?? currentTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [duration, currentTime]);

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

  useEffect(() => {
    if (!scrubbing) return;
    function move(e: PointerEvent) { seekAbsolute(timeFromClientX(e.clientX)); }
    function up() { setScrubbing(false); }
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
    if (!keyboard) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seekAbsolute((videoRef.current?.currentTime ?? 0) - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seekAbsolute((videoRef.current?.currentTime ?? 0) + 1); }
    else if (e.key === ",") { e.preventDefault(); frameStep(-1); }
    else if (e.key === ".") { e.preventDefault(); frameStep(1); }
  }

  const ctrlBtn =
    "grid h-8 w-8 place-items-center rounded-[8px] text-white/80 transition hover:bg-white/10 hover:text-white";

  return (
    <div className="rounded-[16px] p-3" style={{ backgroundColor: "#141118" }}>
      <div
        ref={containerRef}
        tabIndex={keyboard ? 0 : -1}
        onKeyDown={onKey}
        className="relative overflow-hidden rounded-[10px] bg-black outline-none"
      >
        <video
          ref={videoRef}
          src={src}
          playsInline
          autoPlay={autoPlay}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => { if (!scrubbing) report(round2(e.currentTarget.currentTime || 0)); }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={togglePlay}
          className={`mx-auto block w-full object-contain ${maxHeightClass}`}
        />
        {!playing && (
          <button onClick={togglePlay} aria-label="Play" className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </div>

      {/* Scrubber */}
      <div className="mt-3">
        <div ref={barRef} onPointerDown={onScrubDown} className="relative h-3 w-full cursor-pointer rounded-pill bg-white/15">
          <div className="pointer-events-none absolute inset-y-0 left-0 rounded-pill" style={{ width: pct, backgroundColor: "var(--accent)" }} />
          {duration > 0 &&
            markers.map((mk) => (
              <button
                key={mk.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMarkerClick?.(mk.id)}
                className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{ left: `${(mk.timecode / duration) * 100}%` }}
                title={fmtTime(mk.timecode)}
                aria-label={`Comment at ${fmtTime(mk.timecode)}`}
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
                  style={{ backgroundColor: mk.active ? "var(--h-amber)" : "var(--accent)" }}
                >
                  {mk.number ?? "•"}
                </span>
              </button>
            ))}
          <div
            className="pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-2 ring-black/30"
            style={{ left: pct }}
          />
        </div>

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
          <span className="ml-1 tabular-nums text-xs font-bold text-white">{fmtTime(currentTime)}</span>
          <span className="tabular-nums text-xs text-white/40">/ {fmtTime(duration)}</span>
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
  );
});
