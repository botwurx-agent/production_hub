"use client";

// Inspector panels for the Scene Setup prototype's lighting: a fixture, the
// window, the practical, a flag or bounce, and the camera's exposure with its
// light meter. Every number shown comes from lib/previz/lighting.ts and the
// meter, the same figures the picture is drawn from.
import {
  DIFFUSIONS, FIXTURES, FRAME_SIZES, ISOS, MODIFIERS, ND_STEPS, WHITE_BALANCES, WINDOW_SKIES,
  apparentSizeDeg, bestNd, readsAt, softness, stopLabel, stopsLabel, stopsOver, type WindowSky,
} from "@/lib/previz/lighting";
import { GRIP_NAMES, type GripKind, type GripSpec, type LightSpec } from "@/lib/previz/light-build";
import type { Contribution, Reading } from "@/lib/previz/meter";
import { Chip, Field, Readout, TrashIcon } from "./ui";

type Fmt = (m: number) => string;
type Target = { id: string; name: string };

const ROLES = ["Key", "Fill", "Rim", "Back", "Hair", "Kicker", "Background"];
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

/** What one source contributes at the metered subject. */
function AtSubject({ c, total, targetName, fmt }: { c: Contribution | undefined; total: number; targetName: string; fmt: Fmt }) {
  if (!c) return null;
  const share = total > 0 ? Math.round((c.lux / total) * 100) : 0;
  const deg = c.sizeM > 0 && Number.isFinite(c.distM) ? apparentSizeDeg(c.sizeM, c.distM) : 0;
  return (
    <div className="rounded-[12px] border border-border bg-surface-2 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">At {targetName}</p>
      <Readout k="Light from this" v={c.lux > 0 ? `${Math.round(c.lux)} lux` : "none (blocked or aimed away)"} />
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

export function LightInspector({
  s, targets, reading, targetName, fmt, onChange, onDelete,
}: {
  s: LightSpec;
  targets: Target[];
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

      <Field label={`Height · ${fmt(s.y)}`}>
        <Slider label="Height" min={0.3} max={6} step={0.05} value={s.y} onChange={(v) => onChange({ y: v })} />
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

      <AtSubject c={c} total={reading?.lux ?? 0} targetName={targetName} fmt={fmt} />
    </div>
  );
}

export function WindowInspector({ sky, nd, on, reading, targetName, fmt, onChange }: {
  sky: WindowSky; nd: number; on: boolean; reading: Reading | null; targetName: string; fmt: Fmt;
  onChange: (p: { sky?: WindowSky; nd?: number; on?: boolean }) => void;
}) {
  const c = reading?.contributions.find((x) => x.id === "window");
  const sun = reading?.contributions.find((x) => x.id === "sun");
  return (
    <div className="space-y-5">
      <Header eyebrow="Daylight" title="Window" on={on} onToggle={() => onChange({ on: !on })} />
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
      <AtSubject c={c} total={reading?.lux ?? 0} targetName={targetName} fmt={fmt} />
      {sun && sun.lux > 0 ? <Readout k="Direct sun" v={`${Math.round(sun.lux)} lux`} /> : null}
    </div>
  );
}

export function PracticalInspector({ dimmer, cct, on, reading, targetName, fmt, onChange }: {
  dimmer: number; cct: number; on: boolean; reading: Reading | null; targetName: string; fmt: Fmt;
  onChange: (p: { dimmer?: number; cct?: number; on?: boolean }) => void;
}) {
  const c = reading?.contributions.find((x) => x.id === "practical");
  return (
    <div className="space-y-5">
      <Header eyebrow="Practical" title="Pendant over the table" on={on} onToggle={() => onChange({ on: !on })} />
      <Field label={`Dimmer · ${Math.round(dimmer * 100)}%`}>
        <Slider label="Dimmer" min={0.02} max={1} step={0.01} value={dimmer} onChange={(v) => onChange({ dimmer: v })} />
      </Field>
      <Field label={`Bulb · ${cct}K`}>
        <div className="flex flex-wrap gap-1">
          {[2200, 2700, 3200, 4000].map((k) => <Chip key={k} on={cct === k} onClick={() => onChange({ cct: k })}>{k}K</Chip>)}
        </div>
      </Field>
      <AtSubject c={c} total={reading?.lux ?? 0} targetName={targetName} fmt={fmt} />
    </div>
  );
}

export function GripInspector({ g, targets, reading, targetName, fmt, onChange, onDelete }: {
  g: GripSpec; targets: Target[]; reading: Reading | null; targetName: string; fmt: Fmt;
  onChange: (p: Partial<GripSpec>) => void; onDelete: () => void;
}) {
  const c = reading?.contributions.find((x) => x.id === g.id);
  return (
    <div className="space-y-5">
      <Header eyebrow="Grip" title={GRIP_NAMES[g.kind]} onDelete={onDelete} />
      <Field label="Kind">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(GRIP_NAMES) as GripKind[]).map((k) => (
            <Chip key={k} on={g.kind === k} onClick={() => onChange({ kind: k })}>{GRIP_NAMES[k]}</Chip>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {g.kind === "flag" ? "Blocks light: use it to cut a source off a wall or out of the lens." : "Catches light and throws a soft fill back. It only works facing a source."}
        </p>
      </Field>
      <Field label="Size">
        <div className="flex flex-wrap gap-1">
          {[2, 4, 6, 8, 12].map((ft) => <Chip key={ft} on={g.sizeFt === ft} onClick={() => onChange({ sizeFt: ft })}>{ft}x{ft}</Chip>)}
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
      {g.kind !== "flag" ? <AtSubject c={c} total={reading?.lux ?? 0} targetName={targetName} fmt={fmt} /> : null}
    </div>
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
