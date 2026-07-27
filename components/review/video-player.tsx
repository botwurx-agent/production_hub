"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { DrawCanvas } from "@/components/review/draw-canvas";
import type { Drawing } from "@/lib/review-drawing";

// Assumed frame rate. An <video> does not expose true fps, so stepping nudges by
// this; combined with the frame-accurate readout it lands on a specific moment.
const FPS = 24;
const FRAME = 1 / FPS;

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

// Broadcast timecode, HH:MM:SS:FF, the format an editor reads out loud.
export function fmtTimecode(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "00:00:00:00";
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const f = Math.floor((t - Math.floor(t)) * FPS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}:${p(f)}`;
}

// Compact seconds form, used in comment chips where space is tight.
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
  play: () => void;
  getTime: () => number;
};

const SHORTCUTS: [string, string][] = [
  ["Space / K", "Play or pause"],
  ["J / L", "Rewind / fast forward (tap again to go faster)"],
  ["← / →", "Back / forward one second"],
  [", / .", "Previous / next frame"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
];

export const ScrubVideo = forwardRef<
  ScrubVideoHandle,
  {
    src: string;
    markers?: VideoMarker[];
    onMarkerClick?: (id: string) => void;
    onTime?: (t: number) => void;
    maxHeightClass?: string;
    keyboard?: boolean;
    autoPlay?: boolean;
    // Drawn annotation shown over the frame (a saved one, or the in-progress).
    drawing?: Drawing | null;
    drawActive?: boolean;
    drawColor?: string;
    drawSize?: number;
    onDrawChange?: (d: Drawing | null) => void;
  }
>(function ScrubVideo(
  {
    src,
    markers = [],
    onMarkerClick,
    onTime,
    maxHeightClass = "max-h-[60vh]",
    keyboard = true,
    autoPlay = false,
    drawing = null,
    drawActive = false,
    drawColor,
    drawSize,
    onDrawChange,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [asTimecode, setAsTimecode] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const round2 = (t: number) => Math.round(t * 100) / 100;
  const pct = duration
    ? `${Math.min(100, (currentTime / duration) * 100)}%`
    : "0%";

  const report = useCallback(
    (t: number) => {
      setCurrentTime(t);
      onTime?.(t);
    },
    [onTime]
  );

  const seekAbsolute = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.min(duration || t, Math.max(0, t));
      v.currentTime = clamped;
      report(round2(clamped));
    },
    [duration, report]
  );

  useImperativeHandle(
    ref,
    () => ({
      seek: (t: number) => seekAbsolute(t),
      pause: () => videoRef.current?.pause(),
      play: () => videoRef.current?.play().catch(() => {}),
      getTime: () => round2(videoRef.current?.currentTime ?? currentTime),
    }),
    [seekAbsolute, currentTime]
  );

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
  function applySpeed(next: number) {
    setSpeed(next);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }
  // J / L shuttle: tapping again goes faster, the way an NLE behaves.
  function shuttle(dir: -1 | 1) {
    const v = videoRef.current;
    if (!v) return;
    if (dir === 1) {
      const next = speed >= 2 ? 2 : speed >= 1.5 ? 2 : speed >= 1 ? 1.5 : 1;
      applySpeed(next);
      v.play().catch(() => {});
    } else {
      // No native reverse playback: step back in increasingly large jumps.
      v.pause();
      seekAbsolute((v.currentTime ?? 0) - 1);
    }
  }
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function changeVolume(next: number) {
    const v = videoRef.current;
    setVolume(next);
    if (v) {
      v.volume = next;
      v.muted = next === 0;
      setMuted(next === 0);
    }
  }
  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }

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
    if (!keyboard || drawActive) return;
    const k = e.key.toLowerCase();
    if (e.key === " " || k === "k") {
      e.preventDefault();
      togglePlay();
    } else if (k === "j") {
      e.preventDefault();
      shuttle(-1);
    } else if (k === "l") {
      e.preventDefault();
      shuttle(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekAbsolute((videoRef.current?.currentTime ?? 0) - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekAbsolute((videoRef.current?.currentTime ?? 0) + 1);
    } else if (e.key === ",") {
      e.preventDefault();
      frameStep(-1);
    } else if (e.key === ".") {
      e.preventDefault();
      frameStep(1);
    } else if (k === "m") {
      e.preventDefault();
      toggleMute();
    } else if (k === "f") {
      e.preventDefault();
      toggleFullscreen();
    }
  }

  const ctrlBtn =
    "grid h-8 w-8 place-items-center rounded-[8px] text-white/80 transition hover:bg-white/10 hover:text-white";
  const pillBtn =
    "flex h-8 items-center gap-1 rounded-[8px] px-2 text-[11px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white";

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
          loop={loop}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            if (!scrubbing) report(round2(e.currentTarget.currentTime || 0));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={drawActive ? undefined : togglePlay}
          className={`mx-auto block w-full object-contain ${maxHeightClass}`}
        />
        <DrawCanvas
          drawing={drawing}
          active={drawActive}
          color={drawColor}
          size={drawSize}
          onChange={onDrawChange}
        />
        {!playing && !drawActive && (
          <button
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 z-[5] grid place-items-center"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
        {drawActive && (
          <span className="absolute left-3 top-3 z-30 rounded-pill bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
            Drawing on this frame
          </span>
        )}
      </div>

      {/* Scrubber */}
      <div className="mt-3">
        <div
          ref={barRef}
          onPointerDown={onScrubDown}
          onPointerMove={(e) => setHover(timeFromClientX(e.clientX))}
          onPointerLeave={() => setHover(null)}
          className="relative h-3 w-full cursor-pointer rounded-pill bg-white/15"
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-pill"
            style={{ width: pct, backgroundColor: "var(--accent)" }}
          />
          {hover != null && duration > 0 && (
            <span
              className="pointer-events-none absolute -top-7 z-30 -translate-x-1/2 rounded-[6px] bg-black/85 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
              style={{ left: `${(hover / duration) * 100}%` }}
            >
              {fmtTimecode(hover)}
            </span>
          )}
          {duration > 0 &&
            markers.map((mk) => (
              <button
                key={mk.id}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onMarkerClick?.(mk.id)}
                className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{ left: `${(mk.timecode / duration) * 100}%` }}
                title={fmtTimecode(mk.timecode)}
                aria-label={`Comment at ${fmtTimecode(mk.timecode)}`}
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow"
                  style={{
                    backgroundColor: mk.active ? "var(--h-amber)" : "var(--accent)",
                  }}
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

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            onClick={togglePlay}
            className={ctrlBtn}
            aria-label={playing ? "Pause" : "Play"}
            title="Play / pause (space)"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setLoop((v) => !v)}
            className={ctrlBtn}
            title="Loop"
            aria-label="Loop"
            style={loop ? { color: "var(--accent)" } : undefined}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 22l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
          <button
            onClick={() => frameStep(-1)}
            className={ctrlBtn}
            title="Previous frame ( , )"
            aria-label="Previous frame"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 20 9 12l10-8z" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>
          <button
            onClick={() => frameStep(1)}
            className={ctrlBtn}
            title="Next frame ( . )"
            aria-label="Next frame"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 4 10 8-10 8z" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>

          <button
            onClick={() => setAsTimecode((v) => !v)}
            title="Switch between timecode and seconds"
            className="ml-1 rounded-[7px] px-1.5 py-0.5 tabular-nums text-xs font-bold text-white transition hover:bg-white/10"
          >
            {asTimecode ? fmtTimecode(currentTime) : fmtTime(currentTime)}
          </button>
          <span className="tabular-nums text-xs text-white/40">
            / {asTimecode ? fmtTimecode(duration) : fmtTime(duration)}
          </span>

          <span className="flex-1" />

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setSpeedOpen((v) => !v)}
              className={pillBtn}
              title="Playback speed"
            >
              {speed}x
            </button>
            {speedOpen && (
              <div className="absolute bottom-9 right-0 z-40 w-24 overflow-hidden rounded-[10px] border border-white/10 bg-[#1c1922] p-1 shadow-lg">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => applySpeed(s)}
                    className={`flex w-full items-center justify-between rounded-[7px] px-2 py-1 text-[11px] transition hover:bg-white/10 ${
                      s === speed ? "font-extrabold text-white" : "text-white/70"
                    }`}
                  >
                    {s}x
                    {s === speed && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="group flex items-center">
            <button
              onClick={toggleMute}
              className={ctrlBtn}
              aria-label={muted ? "Unmute" : "Mute"}
              title="Mute (m)"
            >
              {muted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H2v6h4l5 4z" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-pill bg-white/25 opacity-0 transition-all duration-150 accent-white group-hover:mr-1 group-hover:w-16 group-hover:opacity-100 focus:mr-1 focus:w-16 focus:opacity-100"
            />
          </div>

          {/* Shortcuts */}
          <div className="relative">
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className={ctrlBtn}
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
              </svg>
            </button>
            {helpOpen && (
              <div className="absolute bottom-9 right-0 z-40 w-64 rounded-[10px] border border-white/10 bg-[#1c1922] p-2.5 shadow-lg">
                <p className="mb-1.5 text-[11px] font-bold text-white">
                  Keyboard
                </p>
                {SHORTCUTS.map(([k, label]) => (
                  <div
                    key={k}
                    className="flex items-start justify-between gap-3 py-0.5"
                  >
                    <span className="shrink-0 rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {k}
                    </span>
                    <span className="text-right text-[10px] text-white/60">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className={ctrlBtn}
            aria-label="Fullscreen"
            title="Fullscreen (f)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});
