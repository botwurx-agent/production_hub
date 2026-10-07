"use client";

// The set side of the Scene Setup prototype: the catalog of things to put on
// the set, the inspector for a placed item, the room's measurements, and the
// scout photo reader. Everything speaks production language and real units.
import { useRef, useState } from "react";
import {
  CATALOG, CATEGORIES, catalogOf, type CatalogEntry, type ItemSpec,
} from "@/lib/previz/catalog";
import {
  FLOORS, WALLS, clampOpening, emptyRoom, wallLength, KITCHEN_ROOM, type Opening, type SetSpec, type WallId,
} from "@/lib/previz/room";
import { UNITS } from "@/lib/previz/model-import";
import { DEFAULT_SPACING, GRID_SPACINGS, POLECAT_MAX, POLECAT_MIN, spanNote, wallToWall } from "@/lib/previz/rigging";
import type { TalentSpec } from "@/lib/previz/scene-build";
import type { RoomDraft } from "@/lib/previz/room-draft";
import { Chip, Field, NumField, Seg, TrashIcon } from "./ui";
import type { Units } from "./setup";

const feet = (m: number, u: Units) => (u === "ft" ? `${(m / 0.3048).toFixed(1)} ft` : `${m.toFixed(2)} m`);

// ---------------------------------------------------------------- add menu

export const PRODUCT_SHAPES = ["bottle", "can", "carton", "pouch", "jar"] as const;

/**
 * Everything that can go on the set, by kind of thing, plus the two ways of
 * bringing in your own: a product from a photo, and a 3D model file.
 */
export function AddMenu({ onAdd, onProductPhoto, onModelFile, onClose }: {
  onAdd: (kind: string) => void;
  onProductPhoto: (shape: string, file: File) => void;
  onModelFile: (file: File) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const [shape, setShape] = useState<string>("bottle");
  const match = (c: CatalogEntry) => !q.trim() || `${c.name} ${c.hint}`.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <div className="max-h-[70vh] w-[360px] overflow-y-auto rounded-[12px] border border-border bg-surface p-3 text-sm shadow-xl">
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); e.stopPropagation(); }}
          placeholder="Find a table, a flat, a riser..."
          className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm"
        />
        <button type="button" onClick={onClose} className="text-xs font-semibold text-text-muted hover:text-text">Close</button>
      </div>

      {!q ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-border p-2">
            <p className="text-xs font-semibold">Product from a photo</p>
            <p className="mb-1.5 text-[11px] text-text-muted">A front-on photo, wrapped onto the shape.</p>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {PRODUCT_SHAPES.map((s) => (
                <Chip key={s} on={shape === s} onClick={() => setShape(s)}>{catalogOf(s).name.replace(" / carton", "")}</Chip>
              ))}
            </div>
            <button type="button" onClick={() => photoRef.current?.click()} className="w-full rounded-[8px] bg-accent px-2 py-1 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
              Choose the photo
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onProductPhoto(shape, f); }} />
          </div>
          <div className="rounded-[10px] border border-border p-2">
            <p className="text-xs font-semibold">Import a 3D model</p>
            <p className="mb-1.5 text-[11px] text-text-muted">GLB, OBJ or STL: a LiDAR room scan, a CAD export, a prop.</p>
            <button type="button" onClick={() => modelRef.current?.click()} className="w-full rounded-[8px] border border-border px-2 py-1 text-xs font-semibold hover:border-border-strong">
              Choose a file
            </button>
            <input ref={modelRef} type="file" accept=".glb,.gltf,.obj,.stl" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onModelFile(f); }} />
          </div>
        </div>
      ) : null}

      {CATEGORIES.filter((c) => c.id !== "model").map((cat) => {
        const list = CATALOG.filter((c) => c.category === cat.id && match(c));
        if (!list.length) return null;
        return (
          <div key={cat.id} className="mb-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{cat.name}</p>
            <div className="grid grid-cols-2 gap-1">
              {list.map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => onAdd(c.kind)}
                  className="flex items-start gap-2 rounded-[8px] px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] border border-black/10" style={{ background: c.color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-text-muted">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- item inspector

/**
 * A grid, a spreader or a polecat: its size, the height of its pipe, and for
 * a grid how far apart the pipes run. A spreader or a polecat can be fitted
 * wall to wall in one press, which is how one is actually put up.
 */
function RigFields({ item, units, walls, hungCount, onChange }: {
  item: ItemSpec;
  units: Units;
  walls: { minX: number; maxX: number; minZ: number; maxZ: number; has: Record<string, boolean> } | null;
  hungCount: number;
  onChange: (p: Partial<ItemSpec>) => void;
}) {
  const grid = item.kind === "grid";
  const span = !grid && walls ? wallToWall(item, walls, walls.has) : null;
  const fits = grid ? null : walls ? !!span && Math.abs(span.w - item.w) < 0.05 : false;
  const note = spanNote(item, fits, span?.w ?? null, span && fits ? span.open : []);
  const spacing = item.spacing ?? DEFAULT_SPACING;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <NumField label={grid ? "Width" : "Length"} value={item.w} units={units} min={item.kind === "polecat" ? POLECAT_MIN : 0.5} max={60} onChange={(v) => onChange({ w: v })} />
        {grid ? <NumField label="Depth" value={item.d} units={units} min={0.5} max={60} onChange={(v) => onChange({ d: v })} /> : null}
        <NumField label="Pipe height" value={item.raise ?? 2.4} units={units} min={1.5} max={15} onChange={(v) => onChange({ raise: v })} />
      </div>
      {grid ? (
        <Field label="Pipes every">
          <div className="flex flex-wrap gap-1">
            {GRID_SPACINGS.map((sp) => (
              <Chip key={sp} on={Math.abs(sp - spacing) < 0.01} onClick={() => onChange({ spacing: sp })}>{feet(sp, units)}</Chip>
            ))}
          </div>
        </Field>
      ) : (
        <div>
          {span ? (
            <button
              type="button"
              onClick={() => onChange({ x: span.x, z: span.z, w: item.kind === "polecat" ? Math.min(span.w, POLECAT_MAX) : span.w })}
              className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold hover:border-border-strong"
            >
              Fit wall to wall ({feet(span.w, units)})
            </button>
          ) : null}
          {note ? <p className="mt-1.5 border-l-2 border-[var(--h-amber)] pl-2 text-xs text-text">{note}</p> : null}
          {!walls ? <p className="mt-1.5 text-xs text-text-muted">This is an open stage, so there are no walls to hold it. Build a room in Set, or use a studio grid.</p> : null}
        </div>
      )}
      <p className="text-xs text-text-muted">
        {hungCount ? `${hungCount} ${hungCount === 1 ? "light hangs" : "lights hang"} from it. ` : ""}
        To hang a light, pick it and choose Hung from {item.name} under Mounted on.
      </p>
    </div>
  );
}

export function ItemInspector({
  item, units, talent, standsOn, labelAspect, modelRaw, lamp, walls, hungCount = 0,
  onChange, onDelete, onDuplicate, onLabelFile, onClearLabel, onHold,
}: {
  item: ItemSpec;
  units: Units;
  /** The room's inside faces and which are walls, for fitting a spreader wall to wall. */
  walls?: { minX: number; maxX: number; minZ: number; maxZ: number; has: Record<string, boolean> } | null;
  /** How many lights hang from this item, for a rig. */
  hungCount?: number;
  talent: TalentSpec[];
  /** What it is standing on, if anything, for a line of context. */
  standsOn: string | null;
  labelAspect: number | null;
  /** An imported model's size in the file's own units. */
  modelRaw: { x: number; y: number; z: number } | null;
  lamp: React.ReactNode;
  onChange: (p: Partial<ItemSpec>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLabelFile: (f: File) => void;
  onClearLabel: () => void;
  onHold: (talentId: string | null) => void;
}) {
  const c = catalogOf(item.kind);
  const photoRef = useRef<HTMLInputElement>(null);
  const isModel = item.kind === "model";
  const holder = talent.find((t) => t.holding === item.id && t.pose === "holding");
  // A model keeps its proportions: changing one size scales all three.
  const size = (k: "w" | "d" | "h", v: number) => {
    if (!isModel) return onChange({ [k]: v });
    const f = v / Math.max(item[k], 1e-6);
    onChange({ w: item.w * f, d: item.d * f, h: item.h * f });
  };
  const eyebrow = CATEGORIES.find((x) => x.id === c.category)?.name.replace(/s$/, "").replace("Props and product", "Prop") ?? "Item";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{eyebrow} · {c.name}</p>
          <input
            aria-label="Name"
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full rounded-[6px] border border-transparent bg-transparent font-display text-base font-bold hover:border-border focus:border-border focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onDuplicate} title="Duplicate (Cmd or Ctrl + D)" className="rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text">
            Duplicate
          </button>
          <button type="button" onClick={onDelete} title="Delete (Delete key)" className="flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text">
            <TrashIcon />
          </button>
        </div>
      </div>

      {c.presets?.length ? (
        <Field label="Size">
          <div className="flex flex-wrap gap-1">
            {c.presets.map((p) => {
              const on = (p.w === undefined || Math.abs(p.w - item.w) < 0.005) && (p.d === undefined || Math.abs(p.d - item.d) < 0.005) && (p.h === undefined || Math.abs(p.h - item.h) < 0.005);
              return <Chip key={p.label} on={on} onClick={() => onChange({ ...(p.w !== undefined ? { w: p.w } : {}), ...(p.d !== undefined ? { d: p.d } : {}), ...(p.h !== undefined ? { h: p.h } : {}) })}>{p.label}</Chip>;
            })}
          </div>
        </Field>
      ) : null}

      {c.category === "rigging" ? (
        <RigFields item={item} units={units} walls={walls ?? null} hungCount={hungCount} onChange={onChange} />
      ) : (
      <>
      <div className="flex gap-2">
        <NumField label="Width" value={item.w} units={units} min={0.01} max={60} onChange={(v) => size("w", v)} />
        <NumField label={item.kind === "seamless" ? "Pulled out" : "Depth"} value={item.d} units={units} min={0.005} max={60} onChange={(v) => size("d", v)} />
        <NumField label="Height" value={item.h} units={units} min={0.005} max={20} onChange={(v) => size("h", v)} />
      </div>

      <Field label={`Turned · ${item.rot}°`}>
        <input
          aria-label="Turn" type="range" min={-180} max={180} step={1} value={item.rot}
          onChange={(e) => onChange({ rot: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-1 flex gap-1">
          {[-90, 0, 90, 180].map((r) => <Chip key={r} on={item.rot === r} onClick={() => onChange({ rot: r })}>{r}°</Chip>)}
        </div>
      </Field>
      </>
      )}

      {c.category === "rigging" ? null : c.hangs ? (
        <NumField label={c.light ? "Hangs at (bulb height)" : "Hangs at (bottom edge)"} value={item.raise ?? c.raise ?? 2} units={units} min={0.3} max={12} onChange={(v) => onChange({ raise: v })} />
      ) : (
        <div>
          <NumField label="Raised off what it stands on" value={item.raise ?? 0} units={units} min={0} max={12} onChange={(v) => onChange({ raise: v })} />
          <p className="mt-1 text-xs text-text-muted">
            {holder ? `In ${holder.name}'s hand.` : standsOn ? `Standing on ${standsOn}.` : "Standing on the floor."}
            {" "}Things stack on their own: drag it onto a table or a riser.
          </p>
        </div>
      )}

      {item.kind !== "model" && !(c.labelled && item.label) ? (
        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-1.5">
            {(c.colors ?? []).map((x) => (
              <button
                key={x.hex} type="button" title={x.name} aria-label={x.name}
                onClick={() => onChange({ color: x.hex })}
                className={`h-6 w-6 rounded-full border ${item.color === x.hex ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : "border-border"}`}
                style={{ background: x.hex }}
              />
            ))}
            <label className="flex items-center gap-1 text-xs text-text-muted">
              <input type="color" value={item.color} onChange={(e) => onChange({ color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border bg-surface" />
              {c.colors?.length ? "Other" : "Pick"}
            </label>
          </div>
        </Field>
      ) : null}

      {c.labelled ? (
        <Field label="Product photo or label">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => photoRef.current?.click()} className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold hover:border-border-strong">
              {item.label ? "Change the photo" : "Use a photo"}
            </button>
            {item.label ? (
              <button type="button" onClick={onClearLabel} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text">Remove it</button>
            ) : null}
            {item.label && labelAspect ? (
              <button
                type="button"
                onClick={() => {
                  // Keep the height (the number on the spec sheet), take the width from the photo.
                  const w = item.h * labelAspect;
                  onChange(c.round ? { w, d: w } : { w });
                }}
                className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text"
              >
                Match proportions to the photo
              </button>
            ) : null}
          </div>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onLabelFile(f); }} />
          <p className="mt-1 text-xs text-text-muted">
            A straight-on photo of the front, cropped to the product. It wraps the front; the back takes its average colour. Kept in this browser only.
          </p>
        </Field>
      ) : null}

      {c.holdable && talent.length ? (
        <Field label="In someone's hand">
          <div className="flex flex-wrap gap-1">
            <Chip on={!holder} onClick={() => onHold(null)}>Nobody</Chip>
            {talent.map((t) => <Chip key={t.id} on={holder?.id === t.id} onClick={() => onHold(t.id)}>{t.name}</Chip>)}
          </div>
          <p className="mt-1 text-xs text-text-muted">Gives them the Holding product pose.</p>
        </Field>
      ) : null}

      {isModel && item.model ? (
        <Field label={`Model · ${item.model.fileName}`}>
          <div className="flex flex-wrap gap-1">
            {UNITS.map((u) => (
              <Chip
                key={u.id}
                on={item.model!.unit === u.id}
                onClick={() => {
                  if (!modelRaw) return onChange({ model: { ...item.model!, unit: u.id } });
                  onChange({ model: { ...item.model!, unit: u.id }, w: modelRaw.x * u.m, h: modelRaw.y * u.m, d: modelRaw.z * u.m });
                }}
              >
                {u.name}
              </Chip>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-muted">
            The file&apos;s units. It reads as {feet(item.w, units)} wide and {feet(item.h, units)} tall: if that is wrong, the units are.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-text-muted">Up is</span>
            <Seg value={item.model.upZ ? "z" : "y"} onChange={(v) => { const upZ = v === "z"; if (upZ === item.model!.upZ) return; onChange({ model: { ...item.model!, upZ }, h: item.d, d: item.h }); }} options={[{ v: "y", l: "Y (most files)" }, { v: "z", l: "Z (CAD)" }]} />
          </div>
        </Field>
      ) : null}

      {lamp}
    </div>
  );
}

// ---------------------------------------------------------------- room

export function RoomInspector({ set, units, onChange, onScout }: {
  set: SetSpec; units: Units; onChange: (s: SetSpec) => void; onScout: () => void;
}) {
  const r = set.room;
  const setR = (p: Partial<typeof r>) => onChange({ ...set, room: { ...r, ...p } });
  const setO = (id: string, p: Partial<Opening>) =>
    setR({ openings: r.openings.map((o) => (o.id === id ? clampOpening(r, { ...o, ...p }) : o)) });
  const addOpening = (kind: "window" | "door") => {
    const wall: WallId = (["left", "back", "right", "front"] as WallId[]).find((w) => r.walls[w]) ?? "back";
    const L = wallLength(r, wall);
    setR({
      openings: [...r.openings, clampOpening(r, {
        id: `o${Date.now()}`, wall, kind, at: L / 2, width: kind === "door" ? 0.9 : 1.5, sill: kind === "door" ? 0 : 0.85, top: kind === "door" ? 2.05 : 2.2,
      })],
    });
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Set</p>
        <h2 className="font-display text-base font-bold">{set.kind === "room" ? "Room" : "Open stage"}</h2>
      </div>
      <Seg
        value={set.kind}
        onChange={(v) => onChange({ ...set, kind: v as SetSpec["kind"] })}
        options={[{ v: "stage", l: "Open stage" }, { v: "room", l: "Room" }]}
      />
      {set.kind === "stage" ? (
        <p className="text-sm text-text-muted">
          A black stage with nothing on it. Add backdrops, flats and set pieces from <span className="font-semibold text-text">+ Add to the set</span>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <Chip on={false} onClick={() => setR({ ...KITCHEN_ROOM, x: r.x, z: r.z })}>Kitchen sample</Chip>
            <Chip on={false} onClick={() => onChange({ ...set, room: { ...emptyRoom(r.width, r.depth, r.height), x: r.x, z: r.z } })}>Plain room</Chip>
            <button type="button" onClick={onScout} className="rounded-[8px] bg-accent px-2 py-1 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
              Build from a scout photo
            </button>
          </div>
          <Field label="Measurements">
            <div className="flex gap-2">
              <NumField label="Width" value={r.width} units={units} min={1} max={60} onChange={(v) => setR({ width: v })} />
              <NumField label="Depth" value={r.depth} units={units} min={1} max={60} onChange={(v) => setR({ depth: v })} />
              <NumField label="Ceiling" value={r.height} units={units} min={1.8} max={20} onChange={(v) => setR({ height: v })} />
            </div>
            <p className="mt-1 text-xs text-text-muted">Inside dimensions, wall to wall. The back-left corner stays put as they change.</p>
          </Field>
          <Field label="Walls">
            <div className="flex flex-wrap gap-1">
              {WALLS.map((w) => (
                <Chip key={w.id} on={r.walls[w.id]} onClick={() => setR({ walls: { ...r.walls, [w.id]: !r.walls[w.id] } })}>{w.name.replace(" wall", "")}</Chip>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">From outside, in free view, walls are see-through; from inside they are solid.</p>
          </Field>
          <Field label="Wall colour">
            <div className="flex flex-wrap items-center gap-1.5">
              {["#e3ddd2", "#d8d0c3", "#f2f0ea", "#c9d3cf", "#b9a990", "#5d5f62"].map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setR({ wallColor: c })}
                  className={`h-6 w-6 rounded-full border ${r.wallColor === c ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : "border-border"}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={r.wallColor} onChange={(e) => setR({ wallColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border bg-surface" />
            </div>
          </Field>
          <Field label="Floor">
            <div className="flex flex-wrap gap-1">
              {FLOORS.map((f) => <Chip key={f.id} on={r.floor === f.id} onClick={() => setR({ floor: f.id })}>{f.name}</Chip>)}
            </div>
          </Field>
          <Field label="Windows and doors">
            <div className="space-y-2">
              {r.openings.map((o) => {
                const wall = WALLS.find((w) => w.id === o.wall)!;
                return (
                  <div key={o.id} className="rounded-[10px] border border-border p-2">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <select
                        aria-label="Kind" value={o.kind}
                        onChange={(e) => setO(o.id, { kind: e.target.value as Opening["kind"], ...(e.target.value === "door" ? { sill: 0, top: 2.05, width: 0.9 } : { sill: 0.85, top: 2.2 }) })}
                        className="rounded-[8px] border border-border bg-surface px-1.5 py-1 text-xs"
                      >
                        <option value="window">Window</option>
                        <option value="door">Door</option>
                      </select>
                      <span className="text-xs text-text-muted">on the</span>
                      <select
                        aria-label="Wall" value={o.wall}
                        onChange={(e) => setO(o.id, { wall: e.target.value as WallId })}
                        className="rounded-[8px] border border-border bg-surface px-1.5 py-1 text-xs"
                      >
                        {WALLS.map((w) => <option key={w.id} value={w.id} disabled={!r.walls[w.id]}>{w.name.toLowerCase()}</option>)}
                      </select>
                      <button type="button" onClick={() => setR({ openings: r.openings.filter((x) => x.id !== o.id) })} aria-label="Remove" className="ml-auto text-text-muted hover:text-text">
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <NumField label={`Centre, ${wall.from}`} value={o.at} units={units} min={0} max={60} onChange={(v) => setO(o.id, { at: v })} />
                      <NumField label="Width" value={o.width} units={units} min={0.3} max={20} onChange={(v) => setO(o.id, { width: v })} />
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      {o.kind === "window" ? <NumField label="Sill" value={o.sill} units={units} min={0} max={10} onChange={(v) => setO(o.id, { sill: v })} /> : null}
                      <NumField label="Top" value={o.top} units={units} min={0.5} max={10} onChange={(v) => setO(o.id, { top: v })} />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-1">
                <button type="button" onClick={() => addOpening("window")} className="flex-1 rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Window</button>
                <button type="button" onClick={() => addOpening("door")} className="flex-1 rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Door</button>
              </div>
            </div>
          </Field>
          <p className="text-xs text-text-muted">
            Have a LiDAR scan of the room (Polycam, Scaniverse, a RoomPlan app)? Import its GLB from + Add to the set: it comes in at its real size.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- scout photo

export type ScoutChoices = { replaceRoom: boolean; clearSet: boolean; addCamera: boolean; items: boolean[] };

/**
 * Reads a location scout photo into a rough room. Two steps on purpose: the
 * photo is read, then the producer sees exactly what was estimated and picks
 * what to build. A model's estimate from one photo is a starting point.
 */
export function ScoutDialog({ units, read, onBuild, onClose }: {
  units: Units;
  read: (file: File) => Promise<{ draft: RoomDraft; photo: string } | { error: string }>;
  onBuild: (draft: RoomDraft, photo: string, c: ScoutChoices) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ draft: RoomDraft; photo: string } | null>(null);
  const [choices, setChoices] = useState<ScoutChoices>({ replaceRoom: true, clearSet: false, addCamera: true, items: [] });
  const pick = async (f: File) => {
    setError(null);
    setRes(null);
    setPreview(URL.createObjectURL(f));
    setBusy(true);
    try {
      const r = await read(f);
      if ("error" in r) setError(r.error);
      else {
        setRes(r);
        setChoices((c) => ({ ...c, items: r.draft.items.map(() => true) }));
      }
    } finally {
      setBusy(false);
    }
  };
  const d = res?.draft;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-[620px] max-w-full overflow-y-auto rounded-[16px] border border-border bg-surface p-5 text-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Build the room from a scout photo</h2>
            <p className="text-xs text-text-muted">
              One photo, taken from a corner or a doorway with the floor in it. The AI estimates the room&apos;s size, its windows and doors, the furniture, and where you were standing. You check it before anything is built.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-text-muted hover:text-text">Close</button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-[150px] w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-border bg-surface-2 text-xs font-semibold text-text-muted hover:border-border-strong"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : "Choose a photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
          <div className="min-w-0 flex-1 text-xs text-text-muted">
            {busy ? <p className="font-semibold text-text">Reading the room...</p> : null}
            {error ? <p className="rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] p-2 text-text">{error}</p> : null}
            {d ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text">
                  About {feet(d.width, units)} wide, {feet(d.depth, units)} deep, {feet(d.height, units)} to the ceiling
                </p>
                <p>
                  {d.openings.filter((o) => o.kind === "window").length} window(s), {d.openings.filter((o) => o.kind === "door").length} door(s), {d.items.length} piece(s) of furniture.
                  {" "}Confidence: <span className="font-semibold text-text">{d.confidence}</span>.
                </p>
                {d.notes ? <p>{d.notes}</p> : null}
              </div>
            ) : !busy && !error ? <p>The photo is sent to the AI provider this deployment uses, read, and not kept.</p> : null}
          </div>
        </div>

        {d ? (
          <>
            {d.items.length ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-text-muted">Furniture it saw</p>
                <div className="grid grid-cols-2 gap-1">
                  {d.items.map((it, i) => (
                    <label key={i} className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 hover:bg-surface-2">
                      <input
                        type="checkbox" checked={choices.items[i] ?? true}
                        onChange={(e) => setChoices((c) => ({ ...c, items: c.items.map((v, j) => (j === i ? e.target.checked : v)) }))}
                        className="accent-[var(--accent)]"
                      />
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-black/10" style={{ background: it.color ?? catalogOf(it.kind).color }} />
                      <span className="truncate text-xs">{it.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-1.5 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={choices.replaceRoom} onChange={(e) => setChoices((c) => ({ ...c, replaceRoom: e.target.checked }))} className="accent-[var(--accent)]" />
                Replace the room with this one
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={choices.clearSet} onChange={(e) => setChoices((c) => ({ ...c, clearSet: e.target.checked }))} className="accent-[var(--accent)]" />
                Clear the furniture and props already on the set (people, lights and cameras stay)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={choices.addCamera} disabled={!d.camera} onChange={(e) => setChoices((c) => ({ ...c, addCamera: e.target.checked }))} className="accent-[var(--accent)]" />
                {d.camera ? "Add a camera where the photo was taken, with the photo as its overlay to line up against" : "It could not tell where the photo was taken from"}
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-[10px] px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text">Cancel</button>
              <button type="button" onClick={() => onBuild(d, res!.photo, choices)} className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong">
                Build it
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">An estimate from one photo. Check the measurements that matter (usually the room&apos;s depth) with a tape, and fix them in the room panel.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
