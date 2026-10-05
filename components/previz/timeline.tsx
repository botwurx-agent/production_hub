"use client";

// The move timeline under the viewport: play, scrub, the start and end frames,
// duration and ease, what the move is in production language and how fast
// it runs, and recording it as a clip. The render loop drives the scrubber
// directly through `tickRef` while playing, so a move plays at full frame
// rate without re-rendering the whole workspace sixty times a second.
import { useEffect, useRef } from "react";
import { EASES, type Ease, type Move, type MoveStats } from "@/lib/previz/camera-move";

export function Timeline({
  move, stats, playhead, playing, recording, tickRef, supportName, supportHint, warnings,
  onPlay, onStop, onSeek, onAdd, onRemove, onChange, onRecord, fmtDist, fmtSpeed, canRecord,
}: {
  move: Move | null;
  stats: MoveStats | null;
  playhead: number;
  playing: boolean;
  recording: boolean;
  tickRef: React.MutableRefObject<((t: number) => void) | null>;
  supportName: string;
  supportHint: string;
  warnings: string[];
  onPlay: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  onChange: (p: Partial<Move>) => void;
  onRecord: () => void;
  fmtDist: (m: number) => string;
  fmtSpeed: (mps: number) => string;
  canRecord: boolean;
}) {
  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dur = move?.durationS ?? 0;

  const paint = (t: number) => {
    const pct = `${(Math.max(0, Math.min(1, t)) * 100).toFixed(2)}%`;
    if (fillRef.current) fillRef.current.style.width = pct;
    if (headRef.current) headRef.current.style.left = pct;
    if (timeRef.current) timeRef.current.textContent = `${(t * dur).toFixed(1)}s / ${dur.toFixed(1)}s`;
  };
  useEffect(() => {
    tickRef.current = paint;
    return () => { tickRef.current = null; };
  });
  useEffect(() => paint(playhead));

  const seekFrom = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };
  const dragging = useRef(false);

  if (!move) {
    return (
      <div className="flex min-h-[56px] flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-sm">
        <span className="font-semibold">Locked off</span>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong"
        >
          + Add a camera move
        </button>
        <span className="text-xs text-text-muted">{supportName}: {supportHint}</span>
      </div>
    );
  }

  const atStart = playhead <= 0.001;
  const atEnd = playhead >= 0.999;
  const editing = playing ? null : atStart ? "start" : atEnd ? "end" : null;
  return (
    <div className="border-t border-border bg-surface px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={playing ? onStop : onPlay}
          disabled={recording}
          aria-label={playing ? "Stop" : "Play the move"}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
          )}
        </button>
        <KeyButton label="Start frame" on={editing === "start"} onClick={() => onSeek(0)} />
        <div
          ref={trackRef}
          className="relative h-8 min-w-[160px] flex-1 cursor-pointer touch-none select-none"
          onPointerDown={(e) => {
            if (playing) return;
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            seekFrom(e.clientX);
          }}
          onPointerMove={(e) => { if (dragging.current) seekFrom(e.clientX); }}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
          <div ref={fillRef} className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent" />
          {[0, 1].map((k) => (
            <div
              key={k}
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-accent bg-surface"
              style={{ left: `${k * 100}%` }}
            />
          ))}
          <div ref={headRef} className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-text" />
        </div>
        <KeyButton label="End frame" on={editing === "end"} onClick={() => onSeek(1)} />
        <span ref={timeRef} className="w-[86px] text-right font-mono text-xs tabular-nums text-text-muted" />
        <label className="flex items-center gap-1 text-xs text-text-muted">
          Length
          <input
            aria-label="Move length in seconds"
            type="number" min={0.5} max={30} step={0.5} value={move.durationS}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) onChange({ durationS: Math.min(30, Math.max(0.5, v)) });
            }}
            className="w-14 rounded-[8px] border border-border bg-surface px-1.5 py-1 text-xs text-text"
          />
          s
        </label>
        <select
          aria-label="Ease"
          value={move.ease}
          onChange={(e) => onChange({ ease: e.target.value as Ease })}
          className="rounded-[8px] border border-border bg-surface px-1.5 py-1 text-xs text-text"
        >
          {EASES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button
          type="button"
          onClick={onRecord}
          disabled={!canRecord || playing}
          title={canRecord ? "Plays the move and saves it as a video" : "This browser cannot record video"}
          className="flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-border-strong disabled:opacity-50"
        >
          <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse" : ""}`} style={{ background: "var(--h-red)" }} />
          {recording ? "Recording" : "Record clip"}
        </button>
        <button type="button" onClick={onRemove} disabled={playing} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text">
          Remove move
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
        {stats ? (
          <>
            <span className="font-semibold text-text">{stats.name}</span>
            {stats.travelM > 0.02 ? <span>{fmtDist(stats.travelM)} of travel, {fmtSpeed(stats.speed)} average, {fmtSpeed(stats.peak)} at its fastest</span> : null}
            {stats.panDeg > 1 ? <span>pans {stats.panDeg.toFixed(0)}°</span> : null}
            {stats.trackM ? <span>needs {fmtDist(stats.trackM)} of track</span> : null}
          </>
        ) : null}
        <span>
          {editing === "start"
            ? "Framing the start: move the camera and it changes where the move begins."
            : editing === "end"
              ? "Framing the end: move the camera and it changes where the move lands."
              : "Between frames: changing the camera jumps to the nearer frame."}
        </span>
        {warnings.map((w) => (
          <span key={w} className="flex items-center gap-1 text-text">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-amber)" }} />
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function KeyButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] border px-2 py-1 text-xs font-semibold transition ${
        on ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
