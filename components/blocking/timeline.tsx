"use client";

// Shot blocking: the dope sheet. A row for the camera and for each thing
// that moves (the still set folds into one row), each key a diamond on a shared ruler. Click the ruler or an empty stretch to
// move the playhead, click a diamond to select it, drag it to re-time it
// (snapped to frames). Bars between keys show where something is moving.
import { useEffect, useRef, useState } from "react";
import type { BlockScene, Key } from "@/lib/blocking/scene";
import { snap, timecode } from "@/lib/blocking/keys";
import { Btn, Num, Select } from "./ui";

export type Track = "camera" | string;
export type KeyRef = { track: Track; t: number };

export function Timeline({
  scene, t, setT, playing, onPlay, loop, setLoop, selected, onSelectTrack, selectedKey, onSelectKey,
  onMoveKey, onDeleteKey, onInsertKey, autoKey, setAutoKey, onDuration, onFps, canEdit,
}: {
  scene: BlockScene;
  t: number;
  setT: (t: number) => void;
  playing: boolean;
  onPlay: () => void;
  loop: boolean;
  setLoop: (v: boolean) => void;
  selected: Track | null;
  onSelectTrack: (track: Track) => void;
  selectedKey: KeyRef | null;
  onSelectKey: (k: KeyRef | null) => void;
  onMoveKey: (track: Track, from: number, to: number) => void;
  onDeleteKey: () => void;
  onInsertKey: () => void;
  autoKey: boolean;
  setAutoKey: (v: boolean) => void;
  onDuration: (d: number) => void;
  onFps: (f: 24 | 25 | 30) => void;
  canEdit: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ track: Track; from: number; to: number } | null>(null);
  const scrubbing = useRef(false);
  const D = scene.duration;
  const fps = scene.fps;
  const timeAt = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return 0;
    return snap(Math.min(D, Math.max(0, ((clientX - r.left) / r.width) * D)), fps);
  };
  const pct = (x: number) => `${(Math.min(D, Math.max(0, x)) / D) * 100}%`;
  // Only what moves earns a row: the camera, anything with two or more keys,
  // anyone riding along with something that moves (indented under it), and
  // whatever is selected, so it can be keyed. The rest of the set folds into
  // one row. Worked out from the keys every render, never stored, so keying a
  // building moves it up and clearing its keys drops it back.
  const [showStill, setShowStill] = useState(false);
  useEffect(() => {
    try { setShowStill(localStorage.getItem("blocking.timelineStill") === "1"); } catch { /* fine */ }
  }, []);
  const toggleStill = () => {
    const v = !showStill;
    setShowStill(v);
    try { localStorage.setItem("blocking.timelineStill", v ? "1" : "0"); } catch { /* fine */ }
  };
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  const movingMemo = new Map<string, boolean>();
  const moves = (id: string, seen = new Set<string>()): boolean => {
    if (movingMemo.has(id)) return movingMemo.get(id)!;
    const o = byId.get(id);
    if (!o || seen.has(id)) return false;
    seen.add(id);
    const v = o.keys.length > 1 || (!!o.parent && moves(o.parent, seen));
    movingMemo.set(id, v);
    return v;
  };
  type Row = { id: Track; name: string; color: string; keys: Key[]; depth: number; still?: boolean };
  const rows: Row[] = [{ id: "camera", name: "Camera", color: "var(--h-amber)", keys: scene.camera.keys, depth: 0 }];
  const placed = new Set<string>();
  const kids = (pid: string) => scene.objects.filter((o) => o.parent === pid);
  const place = (id: string, depth: number) => {
    const o = byId.get(id);
    if (!o || placed.has(id)) return;
    placed.add(id);
    rows.push({ id: o.id, name: o.name, color: o.color, keys: o.keys, depth, still: !moves(id) });
    for (const k of kids(id)) if (moves(k.id) || k.id === selected) place(k.id, depth + 1);
  };
  // A moving thing is listed at the top of its own chain: a passenger sits
  // under its car, the car at the left edge.
  const topMover = (id: string) => {
    let cur = byId.get(id);
    const seen = new Set<string>();
    while (cur?.parent && byId.has(cur.parent) && moves(cur.parent) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent);
    }
    return cur?.id ?? id;
  };
  for (const o of scene.objects) if (moves(o.id)) place(topMover(o.id), 0);
  if (selected && selected !== "camera" && byId.has(selected) && !placed.has(selected)) place(selected, 0);
  const stillOnes = scene.objects.filter((o) => !placed.has(o.id));
  const stillRows: Row[] = stillOnes.map((o) => ({ id: o.id, name: o.name, color: o.color, keys: o.keys, depth: 1, still: true }));
  // Second ticks, thinned out so labels never collide.
  const every = D <= 10 ? 1 : D <= 20 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= D + 1e-6; s += every) ticks.push(s);

  const scrubStart = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubbing.current = true;
    setT(timeAt(e.clientX));
    onSelectKey(null);
  };
  const scrubMove = (e: React.PointerEvent) => { if (scrubbing.current) setT(timeAt(e.clientX)); };
  const scrubEnd = () => (scrubbing.current = false);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-border bg-surface">
      {/* Transport */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Btn title="Go to start (Home)" onClick={() => setT(0)}>⏮</Btn>
        <Btn title="Back one frame (←)" onClick={() => setT(snap(Math.max(0, t - 1 / fps), fps))}>◀︎</Btn>
        <Btn tone="primary" title="Play or pause (Space)" onClick={onPlay} className="w-14">{playing ? "Pause" : "Play"}</Btn>
        <Btn title="Forward one frame (→)" onClick={() => setT(snap(Math.min(D, t + 1 / fps), fps))}>▶︎</Btn>
        <Btn title="Go to end (End)" onClick={() => setT(D)}>⏭</Btn>
        <Btn title="Loop playback" active={loop} onClick={() => setLoop(!loop)}>Loop</Btn>
        <span className="ml-1 rounded-[6px] bg-surface-2 px-2 py-1 font-mono text-[12px] tabular-nums text-text">
          {timecode(t, fps)} <span className="text-text-faint">/ {timecode(D, fps)}</span>
        </span>
        <span className="mx-1 h-5 w-px bg-border" />
        {canEdit && (
          <>
            <Btn tone="rec" active={autoKey} onClick={() => setAutoKey(!autoKey)}
              title="Auto key: every change you make at the playhead sets a keyframe there">
              <span className={`h-2 w-2 rounded-full ${autoKey ? "bg-white" : "bg-red"}`} /> Auto key
            </Btn>
            <Btn onClick={onInsertKey} title="Set a keyframe for the selected thing at the playhead (I)">◆ Keyframe</Btn>
            <Btn onClick={onDeleteKey} disabled={!selectedKey} title="Delete the selected keyframe (Delete)">Delete key</Btn>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-text-faint">Length</span>
          <div className="w-20"><Num value={D} onChange={onDuration} step={0.5} min={1} max={30} suffix="s" digits={1} disabled={!canEdit} /></div>
          <div className="w-[74px]">
            <Select value={String(fps)} onChange={(v) => onFps(Number(v) as 24)} disabled={!canEdit}>
              {[24, 25, 30].map((f) => <option key={f} value={f}>{f} fps</option>)}
            </Select>
          </div>
        </div>
      </div>

      {/* Ruler + rows */}
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="w-[170px] shrink-0 border-r border-border">
          <div className="h-6 border-b border-border" />
          {rows.map((r) => <NameRow key={r.id} r={r} selected={selected} onSelectTrack={onSelectTrack} />)}
          {stillOnes.length > 0 && (
            <button type="button" onClick={toggleStill}
              title={showStill ? "Fold the still objects away" : "Show the objects that do not move"}
              className="flex h-7 w-full items-center gap-2 border-b border-border px-2 text-left text-[11.5px] text-text-faint hover:bg-surface-2">
              <span className="w-2.5 shrink-0 text-center text-[9px]">{showStill ? "▾" : "▸"}</span>
              <span className="truncate">Set: {stillOnes.length} still</span>
            </button>
          )}
          {showStill && stillRows.map((r) => <NameRow key={r.id} r={r} selected={selected} onSelectTrack={onSelectTrack} />)}
        </div>
        <div ref={area} className="relative min-w-0 flex-1 select-none">
          <div className="relative h-6 cursor-ew-resize border-b border-border bg-surface-2"
            onPointerDown={scrubStart} onPointerMove={scrubMove} onPointerUp={scrubEnd}>
            {ticks.map((s) => (
              <div key={s} className="absolute top-0 h-full" style={{ left: pct(s) }}>
                <div className="h-2 w-px bg-border-strong" />
                <span className="absolute left-1 top-1 font-mono text-[10px] text-text-faint">{s}s</span>
              </div>
            ))}
          </div>
          {[...rows, ...(stillOnes.length ? [null] : []), ...(showStill ? stillRows : [])].map((r, ri) => {
            if (!r) return <div key={`still-${ri}`} className="h-7 border-b border-border" />;
            const keys = r.keys;
            return (
              <div key={r.id}
                className={`relative h-7 border-b border-border ${selected === r.id ? "bg-surface-2" : ""}`}
                onPointerDown={(e) => { if (e.target === e.currentTarget) { onSelectTrack(r.id); scrubStart(e); } }}
                onPointerMove={scrubMove} onPointerUp={scrubEnd}>
                {/* Motion bars: a key that leaves toward a different value. */}
                {keys.slice(0, -1).map((k, i) => {
                  const n = keys[i + 1];
                  const moves = k.p.some((v, c) => Math.abs(v - n.p[c]) > 1e-4) || k.r.some((v, c) => Math.abs(v - n.r[c]) > 1e-3)
                    || ("lens" in k && "lens" in n && (k as { lens: number }).lens !== (n as { lens: number }).lens);
                  if (!moves) return null;
                  return (
                    <div key={`b${i}`} className="pointer-events-none absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full opacity-35"
                      style={{ left: pct(k.t), width: `${((n.t - k.t) / D) * 100}%`, background: r.color, ...(k.ease === "hold" ? { opacity: 0.12 } : {}) }} />
                  );
                })}
                {keys.map((k) => {
                  const dragging = drag && drag.track === r.id && Math.abs(drag.from - k.t) < 1e-6;
                  const kt = dragging ? drag!.to : k.t;
                  const sel = selectedKey && selectedKey.track === r.id && Math.abs(selectedKey.t - k.t) < 0.5 / fps;
                  return (
                    <button key={k.t} type="button" title={`${timecode(k.t, fps)} · ${k.ease}`}
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border ${
                        sel ? "border-text bg-amber" : "border-border-strong bg-amber opacity-80 hover:opacity-100"
                      }`}
                      style={{ left: pct(kt) }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        onSelectTrack(r.id);
                        onSelectKey({ track: r.id, t: k.t });
                        setT(k.t);
                        if (canEdit) setDrag({ track: r.id, from: k.t, to: k.t });
                      }}
                      onPointerMove={(e) => { if (drag) setDrag({ ...drag, to: timeAt(e.clientX) }); }}
                      onPointerUp={() => {
                        if (drag && Math.abs(drag.to - drag.from) > 1e-6) {
                          onMoveKey(drag.track, drag.from, drag.to);
                          onSelectKey({ track: drag.track, t: drag.to });
                          setT(drag.to);
                        }
                        setDrag(null);
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
          <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-red" style={{ left: pct(t) }}>
            <div className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-b-[3px] bg-red" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NameRow({ r, selected, onSelectTrack }: {
  r: { id: Track; name: string; color: string; keys: Key[]; depth: number; still?: boolean };
  selected: Track | null;
  onSelectTrack: (track: Track) => void;
}) {
  return (
    <button type="button" onClick={() => onSelectTrack(r.id)}
      style={{ paddingLeft: 8 + r.depth * 14 }}
      className={`flex h-7 w-full items-center gap-2 border-b border-border pr-2 text-left text-[11.5px] ${
        selected === r.id ? "bg-accent-soft text-text" : "text-text-muted hover:bg-surface-2"
      }`}>
      {r.depth > 0 && <span className="-ml-1 text-[10px] text-text-faint">└</span>}
      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
      <span className="truncate">{r.name}</span>
      {r.keys.length > 1 && <span className="ml-auto text-[10px] text-text-faint">{r.keys.length}</span>}
    </button>
  );
}
