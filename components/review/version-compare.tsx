"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtTimecode } from "@/components/review/video-player";
import {
  clampOffset,
  clampWipe,
  defaultPair,
  laneOffsets,
  laneTarget,
  masterIndex,
  offsetLabel,
  shouldResync,
  timelineFrom,
  timelineLength,
  type Lane,
} from "@/lib/compare-sync";

export type CompareVersion = {
  id: string;
  version_number: number;
  created_at?: string;
};

type Mode = "side" | "wipe";
type Audio = "a" | "b" | "off";

// Same assumption as the review player: a <video> does not expose its rate.
const FPS = 24;
const FRAME = 1 / FPS;
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

/**
 * Two versions of one asset, next to each other or under a wipe. Each side has
 * its own version picker, so any pair can be compared (before and after a
 * revision). Context-agnostic: the parent supplies urlFor(id), the token-gated
 * proxy in the portal or a signed URL in the app.
 *
 * For VIDEO the two players share ONE transport: play, scrub, frame step and
 * speed move both, and the follower is corrected whenever it drifts. A head
 * offset lines up two cuts whose action does not start at the same frame (a
 * revision that gained a slate). Compare is for looking; commenting stays on
 * the review canvas, one version at a time, where a note belongs to a version.
 */
export function VersionCompare({
  versions,
  currentId,
  urlFor,
  alt = "",
  kind = "image",
  noSave = false,
}: {
  versions: CompareVersion[];
  currentId: string | null;
  urlFor: (id: string) => string;
  alt?: string;
  kind?: "image" | "video";
  /** Locked downloads: no save menu, no right-click save. */
  noSave?: boolean;
}) {
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  const pair = defaultPair(versions, currentId);
  const [aId, setAId] = useState<string | null>(pair.a);
  const [bId, setBId] = useState<string | null>(pair.b);
  const [mode, setMode] = useState<Mode>("side");
  const [wipe, setWipe] = useState(50);

  if (sorted.length < 2) return null;
  const vA = sorted.find((v) => v.id === aId) ?? null;
  const vB = sorted.find((v) => v.id === bId) ?? null;
  const nameA = vA ? `v${vA.version_number}` : "A";
  const nameB = vB ? `v${vB.version_number}` : "B";

  const pickers = (
    <div className="flex flex-wrap items-center gap-2">
      <Picker label="A" hue="var(--h-blue)" versions={sorted} value={aId} onChange={setAId} />
      <button
        type="button"
        onClick={() => {
          setAId(bId);
          setBId(aId);
        }}
        title="Swap sides"
        className="rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
      >
        ⇄
      </button>
      <Picker label="B" hue="var(--h-green)" versions={sorted} value={bId} onChange={setBId} />
      <div className="ml-auto flex overflow-hidden rounded-[9px] border border-border" role="group" aria-label="Layout">
        {(["side", "wipe"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`px-3 py-1 text-xs font-semibold transition ${
              mode === m ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"
            }`}
          >
            {m === "side" ? "Side by side" : "Wipe"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div data-compare>
      <div className="mb-3">{pickers}</div>
      {kind === "video" ? (
        <VideoPair
          key={`${aId}|${bId}`}
          srcA={aId ? urlFor(aId) : null}
          srcB={bId ? urlFor(bId) : null}
          nameA={nameA}
          nameB={nameB}
          mode={mode}
          wipe={wipe}
          onWipe={setWipe}
          noSave={noSave}
        />
      ) : (
        <ImagePair
          srcA={aId ? urlFor(aId) : null}
          srcB={bId ? urlFor(bId) : null}
          nameA={nameA}
          nameB={nameB}
          alt={alt}
          mode={mode}
          wipe={wipe}
          onWipe={setWipe}
          noSave={noSave}
        />
      )}
      <p className="mt-2 text-xs text-text-faint">
        Comparing is for looking. Go back to the review to leave a note on a version.
      </p>
    </div>
  );
}

function Picker({
  label,
  hue,
  versions,
  value,
  onChange,
}: {
  label: string;
  hue: string;
  versions: CompareVersion[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-text">
      <span className="h-2 w-2 rounded-full" style={{ background: hue }} aria-hidden />
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold text-text outline-none focus:border-border-strong"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            Version {v.version_number}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tag({ name, hue, side }: { name: string; hue: string; side: "left" | "right" }) {
  return (
    <span
      className={`pointer-events-none absolute top-2 z-10 flex items-center gap-1.5 rounded-[7px] border border-border bg-surface px-2 py-0.5 text-[11px] font-bold text-text shadow-sm ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hue }} aria-hidden />
      {name}
    </span>
  );
}

/** The draggable divider. B is drawn over A and clipped to the right of it. */
function useWipeDrag(onWipe: (pct: number) => void) {
  const boxRef = useRef<HTMLDivElement>(null);
  const start = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const box = boxRef.current;
      if (!box) return;
      const at = (x: number) => {
        const r = box.getBoundingClientRect();
        onWipe(clampWipe(((x - r.left) / r.width) * 100));
      };
      at(e.clientX);
      const move = (ev: PointerEvent) => at(ev.clientX);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onWipe]
  );
  return { boxRef, start };
}

function WipeHandle({ wipe, onDown, onWipe }: { wipe: number; onDown: (e: React.PointerEvent) => void; onWipe: (n: number) => void }) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Wipe position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(wipe)}
      onPointerDown={onDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          onWipe(clampWipe(wipe - 2));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          onWipe(clampWipe(wipe + 2));
        }
      }}
      data-wipe-handle
      className="absolute inset-y-0 z-20 w-8 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
      style={{ left: `${wipe}%` }}
    >
      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
      <div className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[13px] font-bold text-black shadow-md">
        ⇔
      </div>
    </div>
  );
}

function ImagePair({
  srcA,
  srcB,
  nameA,
  nameB,
  alt,
  mode,
  wipe,
  onWipe,
  noSave,
}: {
  srcA: string | null;
  srcB: string | null;
  nameA: string;
  nameB: string;
  alt: string;
  mode: Mode;
  wipe: number;
  onWipe: (n: number) => void;
  noSave: boolean;
}) {
  const { boxRef, start } = useWipeDrag(onWipe);
  const guard = noSave ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const img = (src: string | null, clip?: string) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={guard}
        className="absolute inset-0 h-full w-full object-contain"
        style={clip ? { clipPath: clip } : undefined}
      />
    ) : null;

  if (mode === "wipe") {
    return (
      <div ref={boxRef} className="relative aspect-[4/3] select-none overflow-hidden rounded-[14px] border border-border bg-surface-2">
        {img(srcA)}
        {img(srcB, `inset(0 0 0 ${wipe}%)`)}
        <Tag name={nameA} hue="var(--h-blue)" side="left" />
        <Tag name={nameB} hue="var(--h-green)" side="right" />
        <WipeHandle wipe={wipe} onDown={start} onWipe={onWipe} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[
        { src: srcA, name: nameA, hue: "var(--h-blue)" },
        { src: srcB, name: nameB, hue: "var(--h-green)" },
      ].map((p, i) => (
        <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-[14px] border border-border bg-surface-2">
          {img(p.src)}
          <Tag name={p.name} hue={p.hue} side="left" />
        </div>
      ))}
    </div>
  );
}

function VideoPair({
  srcA,
  srcB,
  nameA,
  nameB,
  mode,
  wipe,
  onWipe,
  noSave,
}: {
  srcA: string | null;
  srcB: string | null;
  nameA: string;
  nameB: string;
  mode: Mode;
  wipe: number;
  onWipe: (n: number) => void;
  noSave: boolean;
}) {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState<[number, number]>([0, 0]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [audio, setAudio] = useState<Audio>("b");
  const [loop, setLoop] = useState(false);
  const [offset, setOffset] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const { boxRef, start: startWipe } = useWipeDrag(onWipe);

  const [offA, offB] = laneOffsets(offset);
  const lanes: Lane[] = [
    { duration: dur[0], offset: offA },
    { duration: dur[1], offset: offB },
  ];
  const length = timelineLength(lanes);
  // The rAF loop reads these without re-subscribing every render.
  const live = useRef({ lanes, playing, loop, length });
  live.current = { lanes, playing, loop, length };

  const vids = () => [refA.current, refB.current] as const;

  /** Put both videos on timeline time `to`, each at its own offset. */
  const place = useCallback((to: number, keepPlaying: boolean) => {
    const { lanes: ls } = live.current;
    const tt = Math.max(0, Math.min(to, timelineLength(ls) || to));
    vids().forEach((v, i) => {
      if (!v) return;
      const target = laneTarget(tt, ls[i]);
      if (shouldResync(v.currentTime, target.time, false)) v.currentTime = target.time;
      if (keepPlaying && !target.ended) v.play().catch(() => {});
      else v.pause();
    });
    setT(tt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While playing, the lane with the most left to play drives the clock and
  // the other is corrected when it drifts.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const { lanes: ls, loop: lp, length: len } = live.current;
      const m = masterIndex(ls);
      const both = vids();
      const master = both[m];
      if (master) {
        const now = timelineFrom(master.currentTime, ls[m]);
        setT(now);
        if (master.ended || (len > 0 && now >= len - 0.03)) {
          if (lp) {
            place(0, true);
          } else {
            both.forEach((v) => v?.pause());
            setPlaying(false);
            return;
          }
        } else {
          both.forEach((v, i) => {
            if (!v || i === m) return;
            const target = laneTarget(now, ls[i]);
            if (target.ended) {
              if (!v.paused) v.pause();
              if (shouldResync(v.currentTime, target.time, false)) v.currentTime = target.time;
            } else {
              if (v.paused) v.play().catch(() => {});
              if (shouldResync(v.currentTime, target.time, true)) v.currentTime = target.time;
            }
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Speed and which side is heard apply to both elements.
  useEffect(() => {
    vids().forEach((v, i) => {
      if (!v) return;
      v.playbackRate = speed;
      v.muted = audio === "off" || (audio === "a" ? i !== 0 : i !== 1);
    });
  }, [speed, audio]);

  // A changed offset re-places both on the current moment.
  useEffect(() => {
    place(t, live.current.playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  // Kept as a whole number of frames, so stepping back and forth lands on 0.
  function nudge(frames: number) {
    setOffset((o) => clampOffset(Math.round(o * FPS + frames) / FPS));
  }
  function togglePlay() {
    if (playing) {
      vids().forEach((v) => v?.pause());
      setPlaying(false);
      place(t, false);
    } else {
      const from = length && t >= length - 0.05 ? 0 : t;
      place(from, true);
      setPlaying(true);
    }
  }
  function seekTo(to: number) {
    place(to, playing);
  }
  function step(frames: number) {
    vids().forEach((v) => v?.pause());
    setPlaying(false);
    place(t + frames * FRAME, false);
  }

  function timeFromX(x: number): number {
    const el = barRef.current;
    if (!el || !length) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (x - r.left) / r.width)) * length;
  }
  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => place(timeFromX(e.clientX), false);
    const up = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, length]);

  // Keyboard on the window: the review canvas is not mounted while comparing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (el?.closest?.("[data-wipe-handle]")) return;
      if (e.key === " " || e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekTo(t - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekTo(t + 1);
      } else if (e.key === ",") {
        step(-1);
      } else if (e.key === ".") {
        step(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onMeta = (i: 0 | 1) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const d = e.currentTarget.duration;
    setDur((prev) => {
      const next: [number, number] = [...prev];
      next[i] = Number.isFinite(d) ? d : 0;
      return next;
    });
  };

  // A server-rendered <video> can load its metadata before React attaches
  // the handler, so the event is missed and the timeline reads 0:00. Read
  // what is already known on mount; durationchange covers the rest.
  useEffect(() => {
    vids().forEach((v, i) => {
      if (v && v.readyState >= 1 && Number.isFinite(v.duration)) {
        const d = v.duration;
        setDur((prev) => {
          const next: [number, number] = [...prev];
          next[i] = d;
          return next;
        });
      }
    });
  }, []);

  const video = (i: 0 | 1, src: string | null, clip?: string) =>
    src ? (
      <video
        ref={i === 0 ? refA : refB}
        src={src}
        playsInline
        preload="metadata"
        muted={audio === "off" || (audio === "a" ? i !== 0 : i !== 1)}
        onLoadedMetadata={onMeta(i)}
        onDurationChange={onMeta(i)}
        onClick={togglePlay}
        controlsList={noSave ? "nodownload" : undefined}
        onContextMenu={noSave ? (e) => e.preventDefault() : undefined}
        data-compare-video={i === 0 ? "a" : "b"}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        style={clip ? { clipPath: clip } : undefined}
      />
    ) : null;

  const endA = dur[0] > 0 && laneTarget(t, lanes[0]).ended && t > 0;
  const endB = dur[1] > 0 && laneTarget(t, lanes[1]).ended && t > 0;
  const ended = (name: string) => (
    <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-[6px] bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
      {name} has ended
    </span>
  );
  const pct = length ? `${Math.min(100, (t / length) * 100)}%` : "0%";

  return (
    <div>
      {mode === "wipe" ? (
        <div ref={boxRef} className="relative aspect-video select-none overflow-hidden rounded-[14px] border border-border bg-black">
          {video(0, srcA)}
          {video(1, srcB, `inset(0 0 0 ${wipe}%)`)}
          <Tag name={nameA} hue="var(--h-blue)" side="left" />
          <Tag name={nameB} hue="var(--h-green)" side="right" />
          <WipeHandle wipe={wipe} onDown={startWipe} onWipe={onWipe} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-[14px] border border-border bg-black">
            {video(0, srcA)}
            <Tag name={nameA} hue="var(--h-blue)" side="left" />
            {endA && ended(nameA)}
          </div>
          <div className="relative aspect-video overflow-hidden rounded-[14px] border border-border bg-black">
            {video(1, srcB)}
            <Tag name={nameB} hue="var(--h-green)" side="left" />
            {endB && ended(nameB)}
          </div>
        </div>
      )}

      {/* One transport for both. */}
      <div className="mt-3 rounded-[12px] border border-border bg-surface p-3">
        <div
          ref={barRef}
          onPointerDown={(e) => {
            if (!length) return;
            setScrubbing(true);
            place(timeFromX(e.clientX), false);
          }}
          data-compare-bar
          className="relative h-2 cursor-pointer touch-none rounded-full bg-surface-2"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: pct }} />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow"
            style={{ left: pct }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            data-compare-play
            className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg"
          >
            {playing ? "Pause" : "Play both"}
          </button>
          <button type="button" onClick={() => step(-1)} title="Previous frame (,)" className={ctl}>
            ‹ Frame
          </button>
          <button type="button" onClick={() => step(1)} title="Next frame (.)" className={ctl}>
            Frame ›
          </button>
          <span className="font-mono text-xs tabular-nums text-text" data-compare-time>
            {fmtTimecode(t)}
            <span className="text-text-faint"> / {fmtTimecode(length)}</span>
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-text-muted">
              Speed
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="rounded-[7px] border border-border bg-surface px-1.5 py-0.5 text-xs text-text outline-none"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-text-muted">
              Sound
              <select
                value={audio}
                onChange={(e) => setAudio(e.target.value as Audio)}
                className="rounded-[7px] border border-border bg-surface px-1.5 py-0.5 text-xs text-text outline-none"
              >
                <option value="a">{nameA}</option>
                <option value="b">{nameB}</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-text-muted">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Loop
            </label>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <span className="text-xs font-semibold text-text">Line up</span>
          <button type="button" onClick={() => nudge(-1)} className={ctl} title={`Skip one frame less of ${nameB}, or one more of ${nameA}`}>
            −1f
          </button>
          <button type="button" onClick={() => nudge(1)} className={ctl} title={`Skip one more frame of ${nameB}`}>
            +1f
          </button>
          <button type="button" onClick={() => nudge(-FPS)} className={ctl}>
            −1s
          </button>
          <button type="button" onClick={() => nudge(FPS)} className={ctl}>
            +1s
          </button>
          <span className="text-xs text-text-muted" data-compare-offset>
            {offsetLabel(offset, FPS, nameA, nameB)}
          </span>
          {offset !== 0 && (
            <button type="button" onClick={() => setOffset(0)} className="text-xs font-semibold text-accent hover:underline">
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ctl =
  "rounded-[7px] border border-border px-2 py-1 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text";

/** The "Compare versions" / "Back to review" switch, shared by every review surface. */
export function CompareToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      data-compare-toggle
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold transition ${
        on ? "border-accent bg-accent-soft text-accent" : "border-border-strong text-text-muted hover:text-text"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
      </svg>
      {on ? "Back to review" : "Compare versions"}
    </button>
  );
}
