"use client";

// Inspector panels for the Scene Setup prototype's lighting: a fixture, the
// window, the practical, a flag or bounce, and the camera's exposure with its
// light meter. Every number shown comes from lib/previz/lighting.ts and the
// meter, the same figures the picture is drawn from.
import {
  COLOR_PRESETS, DIFFUSIONS, FIXTURES, FRAME_SIZES, ISOS, MODIFIERS, ND_STEPS, WHITE_BALANCES, WINDOW_SKIES,
  apparentSizeDeg, bestNd, colorOutput, readsAt, soloReading, softness, stopLabel, stopsLabel, stopsOver, stopsWord,
  type WindowSky,
} from "@/lib/previz/lighting";
import { GRIP_NAMES, GRIP_REFLECTANCE, type GripKind, type GripSpec, type LightSpec } from "@/lib/previz/light-build";
import type { Contribution, PatternRead, Reading } from "@/lib/previz/meter";
import {
  LOOK_WORDS, PATTERNS, clampOpen, isPattern, patternLook, patternTransmission, sharpenAdvice, type PatternKind,
} from "@/lib/previz/patterns";
import { Chip, Field, Readout, Seg, TrashIcon } from "./ui";
import { createContext, useContext, useState } from "react";

/**
 * The active shot's stop, ISO and ND, so a light's own panel can say what that
 * light reads in the camera's terms. A context rather than a prop on every
 * inspector: the reading is the camera's, and there is exactly one camera
 * whose settings apply, so it is set once around the inspector column.
 */
export const ShotExposure = createContext<{ stop: number; iso: number; nd: number } | null>(null);

type Fmt = (m: number) => string;
type Target = { id: string; name: string };
/** A rig a light can hang from: a studio grid, a wall spreader, a polecat. */
export type RigOption = { id: string; name: string; kind: string };
/** Where a hung light is: its pipe's height and how high it may go under it. */
export type Hung = { pipeY: number; maxY: number; rigName: string };

const RIG_ADDS: { kind: "grid" | "spreader" | "polecat"; label: string }[] = [
  { kind: "grid", label: "Studio grid" },
  { kind: "spreader", label: "Wall spreader" },
  { kind: "polecat", label: "Polecat" },
];

const ROLES = ["Key", "Fill", "Rim", "Back", "Hair", "Kicker", "Window", "Background"];
const ndLabel = (nd: number) => (nd === 0 ? "None" : nd.toFixed(1));

function Header({ eyebrow, title, onDelete, on, onToggle }: {
  eyebrow: string; title: string; onDelete?: () => void; on?: boolean; onToggle?: () => void;
}) {
  const what = eyebrow.toLowerCase();
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{eyebrow}</p>
        <h2 className="truncate font-display text-base font-bold">{title}</h2>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className={`rounded-[8px] border px-2 py-1 text-xs font-semibold ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
          >
            {on ? "On" : "Off"}
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            title={`Delete this ${what} (Delete key)`}
            className="flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
          >
            <TrashIcon />
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <input
      aria-label={label}
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[var(--accent)]"
    />
  );
}

function AimChips({ aimAt, targets, onChange }: { aimAt: string | null; targets: Target[]; onChange: (id: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {targets.map((t) => <Chip key={t.id} on={aimAt === t.id} onClick={() => onChange(t.id)}>{t.name}</Chip>)}
      <Chip on={aimAt === null} onClick={() => onChange(null)}>By hand</Chip>
    </div>
  );
}

/**
 * What one source contributes at the metered subject, read on its own the way
 * a gaffer meters one light with the others off. The overall over/under stays
 * on the camera: one light is not the whole exposure.
 */
function AtSubject({ c, reading, targetName, fmt }: { c: Contribution | undefined; reading: Reading | null; targetName: string; fmt: Fmt }) {
  const exp = useContext(ShotExposure);
  if (!c) return null;
  const total = reading?.lux ?? 0;
  const share = total > 0 ? Math.round((c.lux / total) * 100) : 0;
  const deg = c.deg ?? (c.sizeM > 0 && Number.isFinite(c.distM) ? apparentSizeDeg(c.sizeM, c.distM) : 0);
  const keyLux = reading?.contributions[0]?.lux ?? 0;
  const solo = exp ? soloReading(c.lux, keyLux, total, exp.stop, exp.iso, exp.nd) : null;
  return (
    <div className="rounded-[12px] border border-border bg-surface-2 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">At {targetName}</p>
      {solo && exp ? (
        <div className="mb-2 border-b border-border pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-lg font-bold">{Math.round(c.lux)} lux</span>
            <span className="text-sm font-semibold">reads {stopLabel(solo.reads)} alone</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {`${capital(stopsWord(solo.vsShot))} your f/${exp.stop}${exp.nd ? ` (ND ${exp.nd.toFixed(1)})` : ""}.`}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {solo.isKey
              ? `The key: the brightest single source here${solo.ratio && solo.ratio >= 1.05 ? `, ${fmtRatio(solo.ratio)} against everything else` : ""}.`
              : `${capital(stopsWord(solo.vsKey ?? 0))} the key${solo.ratio ? ` (${fmtRatio(solo.ratio)})` : ""}.`}
          </p>
        </div>
      ) : (
        <Readout k="Light from this" v={c.lux > 0 ? `${Math.round(c.lux)} lux` : "none (blocked or aimed away)"} />
      )}
      <Readout k="Share of the exposure" v={`${share}%`} />
      {deg > 0 ? (
        <>
          <Readout k="Distance" v={fmt(c.distM)} />
          <Readout k="Quality" v={`${softness(deg)} (${Math.round(deg)}° wide)`} />
        </>
      ) : null}
    </div>
  );
}

const capital = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** A key-to-fill ratio the way it is said on set: 4:1, 2.5:1, not 4.0:1. */
const fmtRatio = (r: number) => `${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}:1`;

/** The swatch for a hue. A literal colour on purpose: it is the light's colour, not a theme token. */
const swatch = (hue: number, sat: number) => `hsl(${Math.round(hue)} ${Math.round(sat * 100)}% 50%)`;

/**
 * HSI mode on an RGB fixture: a named colour, then hue and saturation. States
 * what the colour costs, since a deep blue is a fraction of the white output
 * and that is the surprise on set.
 */
function ColorField({ color, cct, onChange }: {
  color: { hue: number; sat: number };
  cct: number;
  onChange: (c: { hue: number; sat: number }) => void;
}) {
  const near = COLOR_PRESETS.find((p) => Math.abs(((p.hue - color.hue + 540) % 360) - 180) < 4);
  const out = Math.round(colorOutput(color) * 100);
  return (
    <Field label={`Colour · ${near && color.sat > 0.95 ? near.name : `${Math.round(color.hue)}°`}, ${Math.round(color.sat * 100)}% saturation`}>
      <div className="mb-2 flex flex-wrap gap-1">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            aria-label={p.name}
            aria-pressed={near?.name === p.name && color.sat > 0.95}
            onClick={() => onChange({ hue: p.hue, sat: 1 })}
            className={`h-6 w-6 rounded-full border border-border ${near?.name === p.name && color.sat > 0.95 ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
            style={{ background: swatch(p.hue, 1) }}
          />
        ))}
      </div>
      <div
        aria-hidden
        className="mb-1 h-2 rounded-full"
        style={{ background: "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))" }}
      />
      <Slider label="Hue" min={0} max={359} step={1} value={Math.round(color.hue)} onChange={(v) => onChange({ ...color, hue: v })} />
      <div className="mt-2 flex items-center gap-2">
        <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-border" style={{ background: swatch(color.hue, color.sat) }} />
        <div className="min-w-0 flex-1">
          <Slider label="Saturation" min={0} max={1} step={0.01} value={color.sat} onChange={(v) => onChange({ ...color, sat: v })} />
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">
        About {out}% of the light&apos;s white output at this colour, since a saturated colour runs only some of the
        emitters. Below full saturation the colour is mixed with the fixture&apos;s white at {cct}K. Approximate.
      </p>
    </Field>
  );
}

export function LightInspector({
  s, targets, reading, targetName, fmt, rigs, hung, onHangNew, pads, note, onChange, onDelete,
}: {
  s: LightSpec;
  /** Where the light stands, when that is worth saying (outside the room). */
  note?: string | null;
  /** The controller pads that move and aim this light. */
  pads?: React.ReactNode;
  targets: Target[];
  rigs: RigOption[];
  hung: Hung | null;
  /** Adds a rig over the light and hangs it there. */
  onHangNew: (kind: "grid" | "spreader" | "polecat") => void;
  reading: Reading | null;
  targetName: string;
  fmt: Fmt;
  onChange: (p: Partial<LightSpec>) => void;
  onDelete: () => void;
}) {
  const fixture = FIXTURES.find((f) => f.id === s.fixtureId) ?? FIXTURES[0];
  const mod = MODIFIERS[s.modifierId];
  const fixedCct = fixture.cctMin === fixture.cctMax;
  const c = reading?.contributions.find((x) => x.id === s.id);
  return (
    <div className="space-y-5">
      <Header eyebrow="Light" title={`${s.role} · ${fixture.name}`} on={s.on} onToggle={() => onChange({ on: !s.on })} onDelete={onDelete} />
      {note ? <p className="rounded-[8px] border border-border bg-surface-2 px-2 py-1.5 text-xs text-text">{note}</p> : null}

      <Field label="Role">
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => <Chip key={r} on={s.role === r} onClick={() => onChange({ role: r })}>{r}</Chip>)}
        </div>
      </Field>

      <Field label="Fixture">
        <select
          value={s.fixtureId}
          onChange={(e) => {
            const f = FIXTURES.find((x) => x.id === e.target.value) ?? FIXTURES[0];
            onChange({
              fixtureId: f.id,
              modifierId: f.defaultModifier,
              beamDeg: null,
              cct: Math.max(f.cctMin, Math.min(f.cctMax, s.cct)),
              color: f.rgb ? s.color ?? null : null,
              frame: MODIFIERS[f.defaultModifier]?.omni ? null : s.frame,
            });
          }}
          className="w-full rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm"
        >
          {FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>

      <Field label={`Intensity · ${Math.round(s.dimmer * 100)}%`}>
        <Slider label="Intensity" min={0.01} max={1} step={0.01} value={s.dimmer} onChange={(v) => onChange({ dimmer: v })} />
      </Field>

      {fixture.rgb ? (
        <div className="-mb-2">
          <Seg
            value={s.color ? "hsi" : "cct"}
            onChange={(v) => onChange({ color: v === "hsi" ? (s.color ?? { hue: 230, sat: 1 }) : null })}
            options={[{ v: "cct", l: "White (CCT)" }, { v: "hsi", l: "Colour (HSI)" }]}
          />
        </div>
      ) : null}

      {fixture.rgb && s.color ? (
        <ColorField color={s.color} cct={s.cct} onChange={(color) => onChange({ color })} />
      ) : (
      <Field label={fixedCct ? `Colour · ${fixture.cctMin}K, fixed` : `Colour · ${s.cct}K`}>
        {fixedCct ? (
          <p className="text-xs text-text-muted">
            {fixture.cctMin <= 3400 ? "Tungsten. Gel it with CTB to match daylight." : "Daylight. Gel it with CTO to warm it."}
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1">
              {[2700, 3200, 4300, 5600, 6500].filter((k) => k >= fixture.cctMin && k <= fixture.cctMax).map((k) => (
                <Chip key={k} on={s.cct === k} onClick={() => onChange({ cct: k })}>{k}K</Chip>
              ))}
            </div>
            <Slider label="Colour temperature" min={fixture.cctMin} max={fixture.cctMax} step={50} value={s.cct} onChange={(v) => onChange({ cct: v })} />
          </>
        )}
      </Field>
      )}

      {fixture.modifiers.length > 1 ? (
        <Field label="Modifier">
          <div className="flex flex-wrap gap-1">
            {fixture.modifiers.map((m) => (
              <Chip
                key={m}
                on={s.modifierId === m}
                onClick={() => onChange({ modifierId: m, beamDeg: null, frame: MODIFIERS[m]?.omni ? null : s.frame })}
              >
                {MODIFIERS[m]?.name ?? m}
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}

      {mod?.spotFlood ? (
        <Field label={`Beam · ${Math.round(s.beamDeg ?? mod.beamDeg)}° (${(s.beamDeg ?? mod.beamDeg) < 25 ? "spot" : (s.beamDeg ?? mod.beamDeg) > 45 ? "flood" : "medium"})`}>
          <Slider label="Spot to flood" min={mod.spotFlood[0]} max={mod.spotFlood[1]} step={1} value={s.beamDeg ?? mod.beamDeg} onChange={(v) => onChange({ beamDeg: v })} />
        </Field>
      ) : null}

      {!mod?.omni ? (
        <Field label="Diffusion frame">
          <div className="flex flex-wrap gap-1">
            <Chip on={!s.frame} onClick={() => onChange({ frame: null })}>None</Chip>
            {FRAME_SIZES.map((ft) => (
              <Chip
                key={ft}
                on={s.frame?.sizeFt === ft}
                onClick={() => onChange({ frame: { sizeFt: ft, materialId: s.frame?.materialId ?? "half-grid", distM: s.frame?.distM ?? 1.2 } })}
              >
                {ft}x{ft}
              </Chip>
            ))}
          </div>
          {s.frame ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1">
                {DIFFUSIONS.map((d) => (
                  <Chip key={d.id} on={s.frame!.materialId === d.id} onClick={() => onChange({ frame: { ...s.frame!, materialId: d.id } })}>{d.name}</Chip>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs text-text-muted">Frame {fmt(s.frame.distM)} in front of the light</p>
                <Slider label="Frame distance" min={0.3} max={4} step={0.05} value={s.frame.distM} onChange={(v) => onChange({ frame: { ...s.frame!, distM: v } })} />
                <p className="mt-1 text-xs text-text-muted">Further away fills more of the frame: softer and dimmer. Spill around a frame smaller than the beam is not shown.</p>
              </div>
            </div>
          ) : null}
        </Field>
      ) : null}

      {pads ? <Field label="Move and aim">{pads}</Field> : null}

      <Field label="Mounted on">
        <div className="flex flex-wrap gap-1">
          <Chip on={!hung} onClick={() => onChange({ hangFrom: null })}>{fixture.kind === "lantern" ? "Boom stand" : "Stand"}</Chip>
          {rigs.map((r) => (
            <Chip key={r.id} on={s.hangFrom === r.id && !!hung} onClick={() => onChange({ hangFrom: r.id })}>Hung from {r.name}</Chip>
          ))}
        </div>
        {hung ? (
          <p className="mt-1.5 text-xs text-text-muted">
            On a clamp and a drop, {fmt(hung.pipeY - s.y)} under the {hung.rigName.toLowerCase()} at {fmt(hung.pipeY)}. Drag it on the map and it slides along the pipe.
          </p>
        ) : (
          <div className="mt-1.5">
            <p className="mb-1 text-xs text-text-muted">{rigs.length ? "Or hang it from something new:" : "Hang it overhead instead, off the floor and out of frame:"}</p>
            <div className="flex flex-wrap gap-1">
              {RIG_ADDS.map((r) => (
                <button key={r.kind} type="button" onClick={() => onHangNew(r.kind)} className="rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text">
                  + {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>

      <Field label={hung ? `Height · ${fmt(s.y)} (drop ${fmt(hung.pipeY - s.y)})` : `Height · ${fmt(s.y)}`}>
        <Slider label="Height" min={0.3} max={hung ? Math.max(0.35, hung.maxY) : 6} step={0.05} value={Math.min(s.y, hung ? Math.max(0.35, hung.maxY) : 6)} onChange={(v) => onChange({ y: v })} />
      </Field>

      <Field label="Aim at">
        <AimChips aimAt={s.aimAt} targets={targets} onChange={(id) => onChange({ aimAt: id })} />
        {s.aimAt === null ? (
          <div className="mt-2">
            <p className="mb-1 text-xs text-text-muted">Tilt {s.pitch >= 0 ? "up" : "down"} {Math.abs(Math.round(s.pitch))}°. Pan it with the white dot on the map.</p>
            <Slider label="Tilt" min={-89} max={45} step={1} value={s.pitch} onChange={(v) => onChange({ pitch: v })} />
          </div>
        ) : (
          <p className="mt-1 text-xs text-text-muted">Stays on them as either of you moves.</p>
        )}
      </Field>

      <AtSubject c={c} reading={reading} targetName={targetName} fmt={fmt} />
    </div>
  );
}

export type WindowLightStyle = "hard" | "soft12" | "soft20";
const WINDOW_LIGHT_STYLES: { id: WindowLightStyle; label: string; hint: string }[] = [
  { id: "hard", label: "Hard, like sun", hint: "An M18 straight through the glass: a crisp patch on the floor and hard shadows." },
  { id: "soft12", label: "12x12 half grid", hint: "An M18 through a 12x12 of half grid just outside the glass: soft, still directional." },
  { id: "soft20", label: "20x20 full grid", hint: "An M18 through a 20x20 of full grid: the whole window becomes a soft source." },
];

export function WindowInspector({
  sky, nd, on, reading, targetName, fmt, onChange, windows, outside, onLightThrough, onSelectLight,
}: {
  sky: WindowSky; nd: number; on: boolean; reading: Reading | null; targetName: string; fmt: Fmt;
  onChange: (p: { sky?: WindowSky; nd?: number; on?: boolean }) => void;
  windows: { id: string; name: string }[];
  /** Lights already standing outside the room. */
  outside: { id: string; name: string }[];
  onLightThrough: (windowId: string, style: WindowLightStyle) => void;
  onSelectLight: (id: string) => void;
}) {
  const [style, setStyle] = useState<WindowLightStyle>("soft12");
  // Every window in the room adds up to one daylight figure.
  const ws = reading?.contributions.filter((x) => x.id.startsWith("window")) ?? [];
  const c = ws.length ? { ...ws[0], label: "Windows", lux: ws.reduce((n, x) => n + x.lux, 0) } : undefined;
  const sun = reading?.contributions.find((x) => x.id === "sun");
  return (
    <div className="space-y-5">
      <Header eyebrow="Daylight" title="Through the windows" on={on} onToggle={() => onChange({ on: !on })} />
      <Field label="Outside">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(WINDOW_SKIES) as WindowSky[]).map((k) => (
            <Chip key={k} on={sky === k} onClick={() => onChange({ sky: k })}>{WINDOW_SKIES[k].name}</Chip>
          ))}
        </div>
      </Field>
      <Field label="ND gel on the window">
        <div className="flex flex-wrap gap-1">
          {[0, 0.3, 0.6, 0.9, 1.2].map((v) => <Chip key={v} on={nd === v} onClick={() => onChange({ nd: v })}>{ndLabel(v)}</Chip>)}
        </div>
        <p className="mt-1 text-xs text-text-muted">Each 0.3 takes a stop off the window and the view through it, so the outside stops blowing out.</p>
      </Field>
      <AtSubject c={c} reading={reading} targetName={targetName} fmt={fmt} />
      {sun && sun.lux > 0 ? <Readout k="Direct sun" v={`${Math.round(sun.lux)} lux`} /> : null}

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-text-faint">Light a window from outside</p>
          <p className="mt-1 text-xs text-text-muted">
            Most day interiors are lit this way rather than left to the weather. The lamp stands outside, aimed in at the subject and kept on them, and you can move it on the map like any other light.
          </p>
        </div>
        <Field label="Diffusion">
          <div className="flex flex-wrap gap-1">
            {WINDOW_LIGHT_STYLES.map((x) => <Chip key={x.id} on={style === x.id} onClick={() => setStyle(x.id)}>{x.label}</Chip>)}
          </div>
          <p className="mt-1 text-xs text-text-muted">{WINDOW_LIGHT_STYLES.find((x) => x.id === style)?.hint}</p>
        </Field>
        <div className="flex flex-col gap-1">
          {windows.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onLightThrough(w.id, style)}
              className="rounded-[8px] border border-dashed border-border px-2 py-1.5 text-left text-xs font-semibold text-text hover:border-accent hover:text-accent"
            >
              + Light through {w.name.charAt(0).toLowerCase() + w.name.slice(1)}
            </button>
          ))}
        </div>
        {outside.length ? (
          <Field label="Outside now">
            <div className="flex flex-wrap gap-1">
              {outside.map((l) => <Chip key={l.id} on={false} onClick={() => onSelectLight(l.id)}>{l.name}</Chip>)}
            </div>
          </Field>
        ) : null}
        {on ? (
          <p className="text-xs text-text-muted">
            The daylight above still comes through as well. Turn it off to light the window with your lamp alone (a night exterior, or full control), or ND it down.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A practical lamp's controls, inside an item's inspector. */
export function PracticalInspector({ id, dimmer, cct, on, reading, targetName, fmt, onChange }: {
  id: string; dimmer: number; cct: number; on: boolean; reading: Reading | null; targetName: string; fmt: Fmt;
  onChange: (p: { dimmer?: number; cct?: number; on?: boolean }) => void;
}) {
  const c = reading?.contributions.find((x) => x.id === id);
  return (
    <div className="space-y-5">
      <Field label="Practical">
        <button
          type="button"
          onClick={() => onChange({ on: !on })}
          className={`rounded-[8px] border px-2 py-1 text-xs font-semibold ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
        >
          {on ? "On" : "Off"}
        </button>
      </Field>
      <Field label={`Dimmer · ${Math.round(dimmer * 100)}%`}>
        <Slider label="Dimmer" min={0.02} max={1} step={0.01} value={dimmer} onChange={(v) => onChange({ dimmer: v })} />
      </Field>
      <Field label={`Bulb · ${cct}K`}>
        <div className="flex flex-wrap gap-1">
          {[2200, 2700, 3200, 4000].map((k) => <Chip key={k} on={cct === k} onClick={() => onChange({ cct: k })}>{k}K</Chip>)}
        </div>
      </Field>
      <AtSubject c={c} reading={reading} targetName={targetName} fmt={fmt} />
    </div>
  );
}

export function GripInspector({ g, targets, reading, targetName, fmt, pads, pattern, onChange, onDelete }: {
  g: GripSpec; targets: Target[]; reading: Reading | null; targetName: string; fmt: Fmt;
  /** The controller pads that move and aim this board. */
  pads?: React.ReactNode;
  /** A pattern grip: the light it is breaking up and how sharp that lands. */
  pattern?: PatternRead | null;
  onChange: (p: Partial<GripSpec>) => void; onDelete: () => void;
}) {
  const c = reading?.contributions.find((x) => x.id === g.id);
  const kinds = Object.keys(GRIP_NAMES) as GripKind[];
  const boards = kinds.filter((k) => !isPattern(k));
  const patterns = kinds.filter((k) => isPattern(k));
  const isPat = isPattern(g.kind);
  return (
    <div className="space-y-5">
      <Header eyebrow={isPat ? "Pattern" : "Grip"} title={GRIP_NAMES[g.kind]} onDelete={onDelete} />
      {pads ? <Field label="Move and aim">{pads}</Field> : null}
      <Field label="Kind">
        <div className="flex flex-wrap gap-1">
          {boards.map((k) => (
            <Chip key={k} on={g.kind === k} onClick={() => onChange({ kind: k })}>{GRIP_NAMES[k]}</Chip>
          ))}
        </div>
        <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Patterns</p>
        <div className="flex flex-wrap gap-1">
          {patterns.map((k) => (
            <Chip key={k} on={g.kind === k} onClick={() => onChange({ kind: k })}>{GRIP_NAMES[k]}</Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {isPattern(g.kind)
            ? PATTERNS[g.kind].hint
            : g.kind === "flag" ? "Blocks light: use it to cut a source off a wall or out of the lens." : "Catches light and throws a soft fill back. It only works facing a source."}
        </p>
      </Field>
      {isPattern(g.kind) ? <PatternControls g={g} kind={g.kind} pattern={pattern ?? null} fmt={fmt} onChange={onChange} /> : null}
      <Field label="Size">
        <div className="flex flex-wrap gap-1">
          {[2, 3, 4, 6, 8, 12].map((ft) => <Chip key={ft} on={g.sizeFt === ft} onClick={() => onChange({ sizeFt: ft })}>{ft}x{ft}</Chip>)}
        </div>
      </Field>
      <Field label={`Height · ${fmt(g.y)}`}>
        <Slider label="Height" min={0.3} max={4} step={0.05} value={g.y} onChange={(v) => onChange({ y: v })} />
      </Field>
      <Field label="Face toward">
        <AimChips aimAt={g.aimAt} targets={targets} onChange={(id) => onChange({ aimAt: id })} />
        {g.aimAt === null ? (
          <div className="mt-2">
            <Slider label="Tilt" min={-89} max={89} step={1} value={g.pitch} onChange={(v) => onChange({ pitch: v })} />
          </div>
        ) : null}
      </Field>
      {GRIP_REFLECTANCE[g.kind] > 0 ? <AtSubject c={c} reading={reading} targetName={targetName} fmt={fmt} /> : null}
    </div>
  );
}

/** What a pattern is doing to the light through it, and the knobs it has. */
function PatternControls({ g, kind, pattern, fmt, onChange }: {
  g: GripSpec; kind: PatternKind; pattern: PatternRead | null; fmt: Fmt; onChange: (p: Partial<GripSpec>) => void;
}) {
  const t = patternTransmission(kind, g.open);
  const stops = Math.log2(1 / t);
  const look = pattern ? patternLook(pattern.blurM, pattern.featureM) : null;
  const advice = look ? sharpenAdvice(look) : null;
  return (
    <>
      {kind === "blinds" ? (
        <Field label={`Slats open · ${Math.round(clampOpen(g.open) * 100)}%`}>
          <Slider label="Slats open" min={0.1} max={1} step={0.05} value={clampOpen(g.open)} onChange={(v) => onChange({ open: v })} />
        </Field>
      ) : (
        <Field label="Pattern">
          <button
            type="button"
            onClick={() => onChange({ seed: Math.floor(Math.random() * 4294967295) })}
            className="rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-2"
          >
            {kind === "branch" ? "Another branch" : kind === "cookie" ? "Recut the holes" : "Another window"}
          </button>
        </Field>
      )}
      <div className="space-y-1.5 rounded-[10px] border border-border p-3 text-xs">
        <p className="text-text">
          Lets through about {Math.round(t * 100)}% of the light, {stops.toFixed(1)} {stops >= 0.95 && stops < 1.05 ? "stop" : "stops"} down where it falls.
        </p>
        {pattern && look ? (
          <>
            <p className="font-semibold text-text">{LOOK_WORDS[look]}</p>
            <p className="text-text-muted">
              Breaking up the {pattern.lightLabel}: {fmt(pattern.sourceToPatternM)} from the light, {fmt(pattern.patternToSubjectM)} in front of the subject.
            </p>
            {advice ? <p className="text-text-muted">{advice}</p> : null}
          </>
        ) : (
          <p className="text-text-muted">No light reaches the subject through it yet. Put it in a light&apos;s path, or aim a light through it.</p>
        )}
      </div>
    </>
  );
}

/** ISO, ND and white balance, and the meter reading at the subject. */
export function ExposurePanel({ stop, iso, nd, wb, reading, targetName, onChange }: {
  stop: number; iso: number; nd: number; wb: number; reading: Reading | null; targetName: string;
  onChange: (p: { iso?: number; nd?: number; wb?: number }) => void;
}) {
  const lux = reading?.lux ?? 0;
  const over = stopsOver(lux, stop, iso, nd);
  const ok = Math.abs(over) <= 0.5;
  const top = (reading?.contributions ?? []).filter((c) => c.lux > 0.5);
  const key = top[0]?.lux ?? 0;
  const ratio = key > 0 && lux - key > 0.5 ? lux / (lux - key) : null;
  return (
    <div className="space-y-4 rounded-[12px] border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Exposure</p>
      <Field label="ISO">
        <div className="flex flex-wrap gap-1">
          {ISOS.map((v) => <Chip key={v} on={iso === v} onClick={() => onChange({ iso: v })}>{v}</Chip>)}
        </div>
      </Field>
      <Field label="ND filter">
        <div className="flex flex-wrap gap-1">
          {ND_STEPS.map((v) => <Chip key={v} on={nd === v} onClick={() => onChange({ nd: v })}>{ndLabel(v)}</Chip>)}
        </div>
      </Field>
      <Field label="White balance">
        <div className="flex flex-wrap gap-1">
          {WHITE_BALANCES.map((v) => <Chip key={v} on={wb === v} onClick={() => onChange({ wb: v })}>{v}K</Chip>)}
        </div>
      </Field>
      <p className="text-xs text-text-muted">Shutter 180° (1/48 at 24 fps).</p>

      <div className="rounded-[10px] bg-surface-2 p-3">
        <p className="mb-1.5 text-xs text-text-muted">Meter at {targetName}, dome to the lens</p>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg font-bold">{Math.round(lux)} lux</span>
          <span className="text-sm font-semibold">reads {stopLabel(readsAt(lux, iso))}</span>
        </div>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold text-text ${ok ? "border-green/40 bg-green-bg" : "border-amber/40 bg-amber-bg"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green" : "bg-amber"}`} />
          {stopsLabel(over)} at f/{stop}{nd ? ` with ND ${nd.toFixed(1)}` : ""}
        </div>
        {!ok && lux > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ nd: bestNd(lux, stop, iso) })}
            className="ml-2 rounded-[8px] border border-border px-2 py-0.5 text-xs font-semibold hover:border-border-strong"
          >
            Set ND to match
          </button>
        ) : null}
        {top.length ? (
          <div className="mt-3 space-y-0.5 border-t border-border pt-2">
            {top.slice(0, 6).map((c) => (
              <div key={c.id} className="flex justify-between text-xs">
                <span className="text-text-muted">{c.label}</span>
                <span className="font-semibold">{Math.round(c.lux)} lux</span>
              </div>
            ))}
            {ratio ? <p className="pt-1 text-xs text-text-muted">Key to fill {ratio.toFixed(1)}:1</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
