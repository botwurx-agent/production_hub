"use client";

// Shot blocking: the dope sheet. A row for the camera and for each thing
// that moves (the still set folds into one row), each key a diamond on a shared ruler. Click the ruler or an empty stretch to
// move the playhead, click a diamond to select it, drag it to re-time it
// (snapped to frames). Bars between keys show where something is moving.
import { useEffect, useRef, useState } from "react";
import { EASES, type BlockScene, type Key } from "@/lib/blocking/scene";
import { snap, timecode } from "@/lib/blocking/keys";
import { CLIP_KEY, moveLength, parseClip, type Clip } from "@/lib/blocking/track-ops";
import { Btn, Num, Select } from "./ui";

export type Track = "camera" | string;
export type KeyRef = { track: Track; t: number };
export type TrackAction = "copy" | "paste" | "reverse" | "mirrorX" | "mirrorZ" | "shift" | "retime" | "clear";
export type GroupAction = "copy" | "delete" | "ease" | "shift";
export type KeyAction = "jump" | "copy" | "duplicate" | "ease" | "delete";

type Menu =
  | { kind: "key"; x: number; y: number; ref: KeyRef }
  | { kind: "track"; x: number; y: number; track: Track }
  | { kind: "group"; x: number; y: number };

export function Timeline({
  scene, t, setT, playing, onPlay, loop, setLoop, selected, onSelectTrack, selectedKey, onSelectKey,
  onMoveKey, onCopyKeyTo, picked, onPick, onGroupAction, onTrackAction, onKeyAction, onPaste, onDeleteKey, onInsertKey, autoKey, setAutoKey, onDuration, onFps, canEdit,
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
  /** Alt-drag: drop a copy of the key where it is let go. */
  onCopyKeyTo: (track: Track, from: number, to: number) => void;
  /** Several keys picked at once: Shift-click a diamond, or Shift-drag a box. */
  picked: KeyRef[];
  onPick: (refs: KeyRef[]) => void;
  onGroupAction: (refs: KeyRef[], action: GroupAction, arg?: number | string) => void;
  onTrackAction: (track: Track, action: TrackAction, arg?: number) => void;
  onKeyAction: (ref: KeyRef, action: KeyAction, arg?: string) => void;
  /** Paste the clipboard (a key or a whole move) onto a track at the playhead. */
  onPaste: (track: Track) => void;
  onDeleteKey: () => void;
  onInsertKey: () => void;
  autoKey: boolean;
  setAutoKey: (v: boolean) => void;
  onDuration: (d: number) => void;
  onFps: (f: 24 | 25 | 30) => void;
  canEdit: boolean;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ track: Track; from: number; to: number; copy: boolean; group: boolean } | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number; add: boolean; row: string | null; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const openMenu = (e: React.MouseEvent, m: Menu) => {
    e.preventDefault();
    e.stopPropagation();
    try { setClip(parseClip(localStorage.getItem(CLIP_KEY))); } catch { setClip(null); }
    setMenu(m);
  };
  const scrubbing = useRef(false);
  const D = scene.duration;
  const fps = scene.fps;
  const timeAt = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return 0;
    return snap(Math.min(D, Math.max(0, ((clientX - r.left) / r.width) * D)), fps);
  };
  const isIn = (refs: KeyRef[], track: Track, t: number) => refs.some((r) => r.track === track && Math.abs(r.t - t) < 0.5 / fps);
  const togglePick = (ref: KeyRef) =>
    onPick(isIn(picked, ref.track, ref.t) ? picked.filter((r) => !(r.track === ref.track && Math.abs(r.t - ref.t) < 0.5 / fps)) : [...picked, ref]);
  // A drag on empty timeline draws a box. Plain, it replaces what is picked;
  // with Shift it adds to it. A press that does not move is a click: it moves
  // the playhead and selects that track, as before. The ruler always scrubs.
  const boxStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-key]") || el.closest("[data-ruler]")) return;
    const row = el.closest<HTMLElement>("[data-row]");
    if (!e.shiftKey && !row) return;
    if (!e.shiftKey && row && el !== row) return;
    const r = area.current?.getBoundingClientRect();
    if (!r) return;
    e.preventDefault();
    e.stopPropagation();
    area.current!.setPointerCapture(e.pointerId);
    const x = e.clientX - r.left, y = e.clientY - r.top;
    setBox({ x0: x, y0: y, x1: x, y1: y, add: e.shiftKey, row: row?.dataset.row ?? null, moved: false });
  };
  const boxMove = (e: React.PointerEvent) => {
    if (!box) return;
    const r = area.current!.getBoundingClientRect();
    const x1 = e.clientX - r.left, y1 = e.clientY - r.top;
    setBox({ ...box, x1, y1, moved: box.moved || Math.hypot(x1 - box.x0, y1 - box.y0) > 4 });
  };
  const boxEnd = () => {
    if (!box || !area.current) return;
    const r = area.current.getBoundingClientRect();
    if (!box.moved) {
      setBox(null);
      if (box.add) return;
      if (box.row) onSelectTrack(box.row);
      setT(timeAt(box.x0 + r.left));
      onSelectKey(null);
      if (picked.length) onPick([]);
      return;
    }
    const L = Math.min(box.x0, box.x1) + r.left, R = Math.max(box.x0, box.x1) + r.left;
    const T = Math.min(box.y0, box.y1) + r.top, B = Math.max(box.y0, box.y1) + r.top;
    const hit: KeyRef[] = [];
    area.current.querySelectorAll<HTMLElement>("[data-key]").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.right >= L && b.left <= R && b.bottom >= T && b.top <= B) hit.push({ track: el.dataset.track!, t: Number(el.dataset.t) });
    });
    setBox(null);
    if (!box.add) {
      onPick(hit);
      onSelectKey(hit[0] ?? null);
      return;
    }
    if (!hit.length) return;
    const merged = [...picked];
    for (const h of hit) if (!isIn(merged, h.track, h.t)) merged.push(h);
    onPick(merged);
    onSelectKey(hit[0]);
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
    if (picked.length) onPick([]);
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
        {picked.length > 1 && (
          <span className="rounded-[6px] bg-accent-soft px-2 py-1 text-[11.5px] text-text">
            {picked.length} keys picked <span className="text-text-faint">· drag one to move them all · right-click for more · Esc clears</span>
          </span>
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
          {rows.map((r) => <NameRow key={r.id} r={r} selected={selected} onSelectTrack={onSelectTrack}
            onMenu={(e) => { onSelectTrack(r.id); openMenu(e, { kind: "track", x: e.clientX, y: e.clientY, track: r.id }); }} />)}
          {stillOnes.length > 0 && (
            <button type="button" onClick={toggleStill}
              title={showStill ? "Fold the still objects away" : "Show the objects that do not move"}
              className="flex h-7 w-full items-center gap-2 border-b border-border px-2 text-left text-[11.5px] text-text-faint hover:bg-surface-2">
              <span className="w-2.5 shrink-0 text-center text-[9px]">{showStill ? "▾" : "▸"}</span>
              <span className="truncate">Set: {stillOnes.length} still</span>
            </button>
          )}
          {showStill && stillRows.map((r) => <NameRow key={r.id} r={r} selected={selected} onSelectTrack={onSelectTrack}
            onMenu={(e) => { onSelectTrack(r.id); openMenu(e, { kind: "track", x: e.clientX, y: e.clientY, track: r.id }); }} />)}
        </div>
        <div ref={area} className="relative min-w-0 flex-1 select-none"
          onPointerDownCapture={boxStart} onPointerMove={box ? boxMove : undefined} onPointerUp={box ? boxEnd : undefined}>
          <div data-ruler className="relative h-6 cursor-ew-resize border-b border-border bg-surface-2"
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
              <div key={r.id} data-row={r.id}
                className={`relative h-7 border-b border-border ${selected === r.id ? "bg-surface-2" : ""}`}
                onPointerDown={(e) => { if (e.target === e.currentTarget) { onSelectTrack(r.id); scrubStart(e); } }}
                onPointerMove={scrubMove} onPointerUp={scrubEnd}
                onContextMenu={(e) => { onSelectTrack(r.id); openMenu(e, { kind: "track", x: e.clientX, y: e.clientY, track: r.id }); }}>
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
                  const inPick = isIn(picked, r.id, k.t);
                  const dragging = drag && (drag.group ? inPick : drag.track === r.id && Math.abs(drag.from - k.t) < 1e-6);
                  const kt = dragging ? (drag!.group ? Math.min(D, Math.max(0, k.t + drag!.to - drag!.from)) : drag!.to) : k.t;
                  const sel = inPick || (selectedKey && selectedKey.track === r.id && Math.abs(selectedKey.t - k.t) < 0.5 / fps);
                  return (
                    <button key={k.t} type="button" data-key="" data-track={r.id} data-t={k.t}
                      title={`${timecode(k.t, fps)} · ${k.ease}. Right-click for more, Shift-click to pick several, Alt-drag to copy`}
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border ${
                        sel ? "border-text bg-amber" : "border-border-strong bg-amber opacity-80 hover:opacity-100"
                      }`}
                      style={{ left: pct(kt) }}
                      onContextMenu={(e) => {
                        if (inPick && picked.length > 1) { openMenu(e, { kind: "group", x: e.clientX, y: e.clientY }); return; }
                        onSelectTrack(r.id);
                        onSelectKey({ track: r.id, t: k.t });
                        openMenu(e, { kind: "key", x: e.clientX, y: e.clientY, ref: { track: r.id, t: k.t } });
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        if (e.shiftKey) {
                          togglePick({ track: r.id, t: k.t });
                          onSelectKey({ track: r.id, t: k.t });
                          return;
                        }
                        if (inPick && picked.length > 1) {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          if (canEdit) setDrag({ track: r.id, from: k.t, to: k.t, copy: false, group: true });
                          return;
                        }
                        if (picked.length) onPick([]);
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        onSelectTrack(r.id);
                        onSelectKey({ track: r.id, t: k.t });
                        setT(k.t);
                        if (canEdit) setDrag({ track: r.id, from: k.t, to: k.t, copy: e.altKey, group: false });
                      }}
                      onPointerMove={(e) => { if (drag) setDrag({ ...drag, to: timeAt(e.clientX) }); }}
                      onPointerUp={() => {
                        if (drag?.group) {
                          if (Math.abs(drag.to - drag.from) > 1e-6) onGroupAction(picked, "shift", drag.to - drag.from);
                          else {
                            // A plain click on one of the picked keys goes back to that key alone.
                            onPick([]);
                            onSelectTrack(r.id);
                            onSelectKey({ track: r.id, t: k.t });
                            setT(k.t);
                          }
                          setDrag(null);
                          return;
                        }
                        if (drag && Math.abs(drag.to - drag.from) > 1e-6) {
                          if (drag.copy) onCopyKeyTo(drag.track, drag.from, drag.to);
                          else onMoveKey(drag.track, drag.from, drag.to);
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
          {box?.moved && (
            <div className="pointer-events-none absolute z-10 rounded-[3px] border border-accent bg-accent-soft"
              style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0), opacity: 0.6 }} />
          )}
          <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-red" style={{ left: pct(t) }}>
            <div className="absolute -left-[5px] top-0 h-2.5 w-[11px] rounded-b-[3px] bg-red" />
          </div>
        </div>
      </div>
      {menu && (
        <TimelineMenu menu={menu} scene={scene} t={t} clip={clip} canEdit={canEdit} onClose={() => setMenu(null)}
          picked={picked} onGroupAction={onGroupAction}
          onTrackAction={onTrackAction} onKeyAction={onKeyAction} onPaste={onPaste} />
      )}
    </div>
  );
}

const fmtS = (v: number) => `${v.toFixed(2).replace(/\.?0+$/, "")}s`;

/** The right-click menu: one for a keyframe, one for a whole track. */
function TimelineMenu({ menu, scene, t, clip, canEdit, onClose, picked, onGroupAction, onTrackAction, onKeyAction, onPaste }: {
  menu: Menu; scene: BlockScene; t: number; clip: Clip | null; canEdit: boolean; onClose: () => void;
  picked: KeyRef[];
  onGroupAction: (refs: KeyRef[], action: GroupAction, arg?: number | string) => void;
  onTrackAction: (track: Track, action: TrackAction, arg?: number) => void;
  onKeyAction: (ref: KeyRef, action: KeyAction, arg?: string) => void;
  onPaste: (track: Track) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const track = menu.kind === "key" ? menu.ref.track : menu.kind === "track" ? menu.track : picked[0]?.track ?? "camera";
  const keys: Key[] = track === "camera" ? scene.camera.keys : scene.objects.find((o) => o.id === track)?.keys ?? [];
  const name = track === "camera" ? "Camera" : scene.objects.find((o) => o.id === track)?.name ?? "Track";
  const len = moveLength(keys);
  const [newLen, setNewLen] = useState(len || 1);
  const [shiftBy, setShiftBy] = useState(1);
  const fps = scene.fps;

  useEffect(() => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    });
  }, [menu.x, menu.y]);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const pasteLabel = !clip ? "Paste (nothing copied yet)"
    : clip.kind === "key" ? `Paste keyframe at ${timecode(t, fps)}`
    : clip.kind === "group" ? `Paste ${clip.tracks.reduce((a, x) => a + x.keys.length, 0)} keys onto their tracks at ${timecode(t, fps)}`
    : `Paste the move of ${clip.name} at ${timecode(t, fps)}`;
  const item = (label: string, act: () => void, opts: { disabled?: boolean; hint?: string; keep?: boolean; danger?: boolean } = {}) => (
    <button type="button" disabled={opts.disabled}
      onClick={() => { act(); if (!opts.keep) onClose(); }}
      className={`flex w-full items-center justify-between gap-4 rounded-[5px] px-2 py-1.5 text-left text-[12px] disabled:opacity-40 ${
        opts.danger ? "text-red hover:bg-red-bg" : "text-text hover:bg-surface-2"
      } disabled:hover:bg-transparent`}>
      <span>{label}</span>
      {opts.hint && <span className="text-[10.5px] text-text-faint">{opts.hint}</span>}
    </button>
  );
  const sep = <div className="my-1 h-px bg-border" />;
  const head = (text: string) => <div className="px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-text-faint">{text}</div>;
  const chip = (label: string, act: () => void, on = false) => (
    <button type="button" onClick={act}
      className={`rounded-[5px] border px-1.5 py-0.5 text-[11px] ${on ? "border-accent bg-accent-soft text-text" : "border-border text-text-muted hover:bg-surface-2 hover:text-text"}`}>
      {label}
    </button>
  );

  let body: React.ReactNode;
  if (menu.kind === "group") {
    const tracks = new Set(picked.map((p) => p.track)).size;
    body = (
      <>
        {head(`${picked.length} keys picked${tracks > 1 ? ` on ${tracks} tracks` : ""}`)}
        {item("Copy these keys", () => onGroupAction(picked, "copy"), { hint: "⌘C" })}
        {canEdit && (
          <>
            {sep}
            {head("Shift in time")}
            <div className="flex flex-wrap items-center gap-1 px-2 pb-1">
              {chip("−1s", () => onGroupAction(picked, "shift", -1))}
              {chip("−1f", () => onGroupAction(picked, "shift", -1 / fps))}
              {chip("+1f", () => onGroupAction(picked, "shift", 1 / fps))}
              {chip("+1s", () => onGroupAction(picked, "shift", 1))}
            </div>
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <div className="w-20"><Num value={shiftBy} onChange={setShiftBy} step={0.25} min={0.04} max={30} suffix="s" digits={2} /></div>
              {chip("Earlier", () => onGroupAction(picked, "shift", -shiftBy))}
              {chip("Later", () => onGroupAction(picked, "shift", shiftBy))}
            </div>
            {sep}
            {head("Leaving each of these")}
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {EASES.map((e) => <span key={e.id} title={e.hint}>{chip(e.name, () => onGroupAction(picked, "ease", e.id))}</span>)}
            </div>
            {sep}
            {item(`Delete ${picked.length} keys`, () => onGroupAction(picked, "delete"), { danger: true, hint: "Del" })}
          </>
        )}
      </>
    );
  } else if (menu.kind === "key") {
    const ref = menu.ref;
    const k = keys.find((x) => Math.abs(x.t - ref.t) < 0.5 / fps);
    const atSame = Math.abs(snap(t, fps) - ref.t) < 0.5 / fps;
    body = (
      <>
        {head(`${name} · keyframe at ${timecode(ref.t, fps)}`)}
        {item("Go to this keyframe", () => onKeyAction(ref, "jump"))}
        {item("Copy keyframe", () => onKeyAction(ref, "copy"), { hint: "⌘C" })}
        {canEdit && item(pasteLabel, () => onPaste(track), { disabled: !clip, hint: "⌘V" })}
        {canEdit && item(atSame ? "Copy to the playhead (move it first)" : `Copy to the playhead (${timecode(t, fps)})`, () => onKeyAction(ref, "duplicate"), { disabled: atSame, hint: "Alt-drag" })}
        {canEdit && k && (
          <>
            {sep}
            {head("Leaving this keyframe")}
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {EASES.map((e) => <span key={e.id} title={e.hint}>{chip(e.name, () => onKeyAction(ref, "ease", e.id), k.ease === e.id)}</span>)}
            </div>
            {sep}
            {item("Delete keyframe", () => onKeyAction(ref, "delete"), { danger: true, disabled: keys.length <= 1, hint: "Del" })}
          </>
        )}
      </>
    );
  } else {
    const moving = keys.length > 1;
    body = (
      <>
        {head(moving ? `${name} · ${keys.length} keys over ${fmtS(len)}` : `${name} · not moving`)}
        {item(moving ? "Copy the move" : "Copy where it stands", () => onTrackAction(track, "copy"), { hint: "⌘C" })}
        {canEdit && item(pasteLabel, () => onPaste(track), { disabled: !clip, hint: "⌘V" })}
        {canEdit && (
          <>
            {sep}
            {item("Reverse the move", () => onTrackAction(track, "reverse"), { disabled: !moving, hint: moving ? "plays backwards" : undefined })}
            {item("Mirror left to right", () => onTrackAction(track, "mirrorX"), { disabled: !moving, hint: moving ? "crosses the other way" : undefined })}
            {item("Mirror front to back", () => onTrackAction(track, "mirrorZ"), { disabled: !moving, hint: moving ? "near becomes far" : undefined })}
            {moving && (
              <>
                {sep}
                {head("Shift in time")}
                <div className="flex flex-wrap items-center gap-1 px-2 pb-1">
                  {chip("−1s", () => onTrackAction(track, "shift", -1))}
                  {chip("−1f", () => onTrackAction(track, "shift", -1 / fps))}
                  {chip("+1f", () => onTrackAction(track, "shift", 1 / fps))}
                  {chip("+1s", () => onTrackAction(track, "shift", 1))}
                </div>
                <div className="flex items-center gap-1.5 px-2 pb-1">
                  <div className="w-20"><Num value={shiftBy} onChange={setShiftBy} step={0.25} min={0.04} max={30} suffix="s" digits={2} /></div>
                  {chip("Earlier", () => onTrackAction(track, "shift", -shiftBy))}
                  {chip("Later", () => onTrackAction(track, "shift", shiftBy))}
                </div>
                {head(`Length of the move (now ${fmtS(len)})`)}
                <div className="flex items-center gap-1.5 px-2 pb-1">
                  <div className="w-20"><Num value={newLen} onChange={setNewLen} step={0.25} min={(keys.length - 1) / fps} max={scene.duration} suffix="s" digits={2} /></div>
                  {chip("Apply", () => { onTrackAction(track, "retime", newLen); onClose(); })}
                  {chip("Half", () => { onTrackAction(track, "retime", len / 2); onClose(); })}
                  {chip("Double", () => { onTrackAction(track, "retime", len * 2); onClose(); })}
                </div>
                <p className="px-2 pb-1 text-[10.5px] leading-snug text-text-faint">Same route, faster or slower. It starts where it starts now.</p>
              </>
            )}
            {sep}
            {item("Clear keys, stay here", () => onTrackAction(track, "clear"), { danger: true, disabled: !moving, hint: timecode(t, fps) })}
          </>
        )}
      </>
    );
  }

  return (
    <div ref={box} role="menu" onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[90] w-[290px] rounded-[8px] border border-border bg-surface p-1 shadow-2xl"
      style={{ left: pos.x, top: pos.y }}>
      {body}
    </div>
  );
}

function NameRow({ r, selected, onSelectTrack, onMenu }: {
  r: { id: Track; name: string; color: string; keys: Key[]; depth: number; still?: boolean };
  selected: Track | null;
  onSelectTrack: (track: Track) => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <button type="button" onClick={() => onSelectTrack(r.id)} onContextMenu={onMenu} title="Right-click for move options"
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
