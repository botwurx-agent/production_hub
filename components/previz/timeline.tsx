"use client";

// The move timeline under the viewport: play, scrub, the start and end frames,
// duration and ease, what the move is in production language and how fast
// it runs, and recording it as a clip. The render loop drives the scrubber
// directly through `tickRef` while playing, so a move plays at full frame
// rate without re-rendering the whole workspace sixty times a second.
import { useEffect, useRef } from "react";
import { EASES, type Ease, type Move, type MoveStats } from "@/lib/previz/camera-move";

// The two ends of a move, by letter and colour everywhere they appear: the
// cards here, the border on the frame, the outlines and the map.
export const FRAME_A = "var(--h-green)";
export const FRAME_B = "var(--h-blue)";

export function Timeline({
  move, stats, playhead, playing, recording, tickRef, supportName, supportHint, warnings,
  onPlay, onStop, onSeek, onAdd, onRemove, onChange, onRecord, fmtDist, fmtSpeed, canRecord, onAddAction, walkers,
  lockedOff, unsaved, thumbA, thumbB, lensA, lensB, onStamp, onDiscard,
}: {
  /** Somebody has a mark to walk to: offers a timeline with the camera locked off. */
  onAddAction?: () => void;
  /** Who walks during the move, for the line under the scrubber. */
  walkers?: string[];
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
  /** The action plays and the camera does not move: no frames to set. */
  lockedOff: boolean;
  /** The camera has been moved and not yet set as either end. */
  unsaved: boolean;
  thumbA: string | null;
  thumbB: string | null;
  lensA: string;
  lensB: string;
  onStamp: (to: "start" | "end") => void;
  onDiscard: () => void;
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
        {onAddAction ? (
          <button
            type="button"
            onClick={onAddAction}
            className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold hover:border-border-strong"
          >
            + Play the action, camera locked off
          </button>
        ) : null}
        <span className="text-xs text-text-muted">{supportName}: {supportHint}</span>
      </div>
    );
  }

  const atStart = playhead <= 0.001;
  const atEnd = playhead >= 0.999;
  const on: "start" | "end" | null = playing || unsaved ? null : atStart ? "start" : atEnd ? "end" : null;
  // While framing is unsaved nothing moves the playhead: it would either throw
  // the framing away or play a move that is not the one on screen.
  const locked = unsaved || recording;

  const transport = (
    <>
      <button
        type="button"
        onClick={playing ? onStop : onPlay}
        disabled={recording || unsaved}
        aria-label={playing ? "Stop" : lockedOff ? "Play the action" : "Play the move"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:bg-accent-strong disabled:opacity-40"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
        )}
      </button>
      <div
        ref={trackRef}
        className={`relative h-8 min-w-[120px] flex-1 touch-none select-none ${locked ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
        onPointerDown={(e) => {
          if (playing || locked) return;
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
        {lockedOff
          ? null
          : (["A", "B"] as const).map((k, i) => (
              <span
                key={k}
                className="absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ left: `${i * 100}%`, background: i ? FRAME_B : FRAME_A }}
              >
                {k}
              </span>
            ))}
        <div ref={headRef} className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-text" />
      </div>
      <span ref={timeRef} className="w-[86px] shrink-0 text-right font-mono text-xs tabular-nums text-text-muted" />
    </>
  );

  const settings = (
    <div className="flex flex-wrap items-center gap-2">
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
      {lockedOff ? null : (
        <select
          aria-label="Ease"
          value={move.ease}
          onChange={(e) => onChange({ ease: e.target.value as Ease })}
          className="rounded-[8px] border border-border bg-surface px-1.5 py-1 text-xs text-text"
        >
          {EASES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={onRecord}
        disabled={!canRecord || playing || unsaved}
        title={canRecord ? "Plays the move and saves it as a video" : "This browser cannot record video"}
        className="flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-border-strong disabled:opacity-50"
      >
        <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse" : ""}`} style={{ background: "var(--h-red)" }} />
        {recording ? "Recording" : "Record clip"}
      </button>
      {lockedOff ? (
        <button type="button" onClick={onAdd} disabled={playing} className="rounded-[10px] bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50">
          Make it a camera move
        </button>
      ) : null}
      <button type="button" onClick={onRemove} disabled={playing} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text">
        {lockedOff ? "Remove timeline" : "Remove move"}
      </button>
    </div>
  );

  if (lockedOff) {
    return (
      <div className="border-t border-border bg-surface px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Camera locked off</span>
          <div className="flex min-w-[240px] flex-1 items-center gap-2">{transport}</div>
          {settings}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {walkers?.length ? `${walkers.join(", ")} ${walkers.length === 1 ? "walks" : "walk"} while the camera holds. ` : "The action plays while the camera holds. "}
          Move the camera to reframe it: there is only one frame to set.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-surface px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <FrameCard letter="A" label="Start" color={FRAME_A} thumb={thumbA} lens={lensA} on={on === "start"} disabled={locked || playing} onClick={() => onSeek(0)} />
        <div className="flex min-w-0 flex-1 items-center gap-2">{transport}</div>
        <FrameCard letter="B" label="End" color={FRAME_B} thumb={thumbB} lens={lensB} on={on === "end"} disabled={locked || playing} onClick={() => onSeek(1)} />
      </div>

      {unsaved ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2"
          style={{ borderColor: "var(--h-amber)", background: "var(--h-amber-bg)" }}
        >
          <span className="mr-auto text-xs text-text">
            <span className="font-semibold">Unsaved framing.</span> The move has not changed. Set it as one end, or discard it.
          </span>
          <StampButton letter="A" color={FRAME_A} label="Set as start" onClick={() => onStamp("start")} />
          <StampButton letter="B" color={FRAME_B} label="Set as end" onClick={() => onStamp("end")} />
          <button type="button" onClick={onDiscard} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text">
            Discard
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-text-muted">
          {playing
            ? "Playing the move."
            : on === "start"
              ? "Showing the start (A). Move the camera to reframe, then set it as the start or the end."
              : on === "end"
                ? "Showing the end (B). Move the camera to reframe, then set it as the start or the end."
                : "Previewing a moment of the move. Move the camera to frame from here, then set it as the start or the end."}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {settings}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
          {stats ? (
            <>
              <span className="font-semibold text-text">{stats.name}</span>
              {stats.travelM > 0.02 ? <span>{fmtDist(stats.travelM)} of travel, {fmtSpeed(stats.speed)} average, {fmtSpeed(stats.peak)} at its fastest</span> : null}
              {stats.panDeg > 1 ? <span>pans {stats.panDeg.toFixed(0)}°</span> : null}
              {stats.trackM && stats.travelM > 0.02 ? <span>needs {fmtDist(stats.trackM)} of track</span> : null}
              {walkers?.length ? <span>{walkers.join(", ")} {walkers.length === 1 ? "walks" : "walk"} to {walkers.length === 1 ? "their mark" : "their marks"}</span> : null}
            </>
          ) : null}
          <span>{supportName}: {supportHint}</span>
          {warnings.map((w) => (
            <span key={w} className="flex items-center gap-1 text-text">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-amber)" }} />
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** One end of the move: what it frames, and a click to look at it. */
function FrameCard({ letter, label, color, thumb, lens, on, disabled, onClick }: {
  letter: string; label: string; color: string; thumb: string | null; lens: string; on: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={`Show the ${label.toLowerCase()} frame`}
      className="flex shrink-0 items-center gap-2 rounded-[10px] border-2 p-1 pr-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: on ? color : "var(--border)" }}
    >
      <span className="relative block h-[45px] w-[80px] overflow-hidden rounded-[6px] bg-[#1b1c1f]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : null}
        <span
          className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ background: color }}
        >
          {letter}
        </span>
      </span>
      <span className="leading-tight">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block text-[11px] text-text-muted">{lens}</span>
      </span>
    </button>
  );
}

function StampButton({ letter, color, label, onClick }: { letter: string; color: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold hover:border-border-strong"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: color }}>{letter}</span>
      {label}
    </button>
  );
}
