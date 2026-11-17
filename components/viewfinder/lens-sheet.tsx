"use client";

// The lens picker: maker, series, then the focal lengths that series really
// comes in, plus an extender and a place to type in a set of your own. Three
// columns side by side, each scrolling by itself, the way a camera assistant
// reads a lens list.
import { useMemo, useState } from "react";
import {
  CUSTOM_MAKE,
  EXTENDERS,
  LENS_MAKES,
  mm,
  parseCustomSeries,
  parseFocalList,
  seriesFocals,
  type LensSeries,
} from "@/lib/lens-library";

const KEY = "viewfinder.lensSets";

export function readCustomSets(): LensSeries[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(parseCustomSeries).filter((s): s is LensSeries => !!s).slice(0, 40);
  } catch {
    return [];
  }
}

export function writeCustomSets(sets: LensSeries[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sets));
  } catch {
    /* ignore */
  }
}

type Props = {
  seriesId: string;
  focal: number;
  extId: string;
  custom: LensSeries[];
  /** Angle of view across the frame for a focal length on the chosen set. */
  angle: (focal: number, squeeze: number) => number;
  onSeries: (id: string) => void;
  onFocal: (f: number) => void;
  onExt: (id: string) => void;
  onCustom: (sets: LensSeries[]) => void;
};

export function LensSheet({ seriesId, focal, extId, custom, angle, onSeries, onFocal, onExt, onCustom }: Props) {
  const makes = useMemo(
    () => (custom.length ? [{ name: CUSTOM_MAKE, series: custom }, ...LENS_MAKES] : LENS_MAKES),
    [custom],
  );
  const owner = makes.find((m) => m.series.some((s) => s.id === seriesId)) ?? makes[0];
  const [makeName, setMakeName] = useState(owner.name);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [list, setList] = useState("");
  const [sq, setSq] = useState("1");

  const needle = q.trim().toLowerCase();
  const shownMakes = needle
    ? makes.filter((m) => m.name.toLowerCase().includes(needle) || m.series.some((s) => s.name.toLowerCase().includes(needle)))
    : makes;
  const make = shownMakes.find((m) => m.name === makeName) ?? shownMakes[0];
  const shownSeries = make
    ? needle && !make.name.toLowerCase().includes(needle)
      ? make.series.filter((s) => s.name.toLowerCase().includes(needle))
      : make.series
    : [];
  const series = makes.flatMap((m) => m.series).find((s) => s.id === seriesId);
  const focals = series ? seriesFocals(series) : [];
  const typed = parseFocalList(list);

  const col = "min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin]";
  const row = (on: boolean) => `block w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] ${on ? "bg-white font-semibold text-black" : "text-white/85 active:bg-white/10"}`;

  const save = () => {
    const made = parseCustomSeries({ id: `custom/${Date.now().toString(36)}`, name, focals: typed, squeeze: Number(sq) });
    if (!made) return;
    const next = [made, ...custom];
    onCustom(next);
    onSeries(made.id);
    setMakeName(CUSTOM_MAKE);
    setAdding(false);
    setName("");
    setList("");
    setSq("1");
  };

  return (
    <div data-lens-sheet>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a maker or a lens set"
        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
      />
      <div className="mt-2 grid h-[min(46vh,340px)] grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.9fr)] gap-1.5 landscape:h-[min(42vh,300px)]">
        <div className="flex min-h-0 flex-col">
          <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Make</div>
          <div className={col}>
            {shownMakes.map((m) => (
              <button key={m.name} type="button" onClick={() => setMakeName(m.name)} className={row(m.name === make?.name)}>{m.name}</button>
            ))}
            {!shownMakes.length && <div className="px-2 py-1.5 text-[13px] text-white/45">Nothing matches.</div>}
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Series</div>
          <div className={col}>
            {shownSeries.map((s) => (
              <div key={s.id} className="flex items-center">
                <button type="button" onClick={() => onSeries(s.id)} className={row(s.id === seriesId)}>{s.name}</button>
                {make?.name === CUSTOM_MAKE && (
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => onCustom(custom.filter((c) => c.id !== s.id))}
                    className="shrink-0 px-2 py-1.5 text-white/45"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Focal length</div>
          <div className={col}>
            {series && focals.map((f) => {
              const on = Math.abs(focal - f) < 0.05;
              return (
                <button key={f} type="button" onClick={() => onFocal(f)} className={`flex w-full items-baseline justify-between rounded-md px-2 py-1.5 text-left text-[13px] tabular-nums ${on ? "bg-white font-semibold text-black" : "text-white/85 active:bg-white/10"}`}>
                  <span>{mm(f)}mm</span>
                  <span className={on ? "text-black/55" : "text-white/40"}>{angle(f, series.squeeze ?? 1).toFixed(1)}°</span>
                </button>
              );
            })}
            {series?.zoom && (
              <div className="px-2 pt-1.5 text-[11px] leading-snug text-white/45">A zoom: use − and + on the lens strip for any length in between.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Extender</span>
        {EXTENDERS.map((e) => (
          <button key={e.id} type="button" onClick={() => onExt(e.id)} className={`rounded-full px-3 py-1 text-[13px] ${e.id === extId ? "bg-white font-semibold text-black" : "bg-white/10"}`}>{e.label}</button>
        ))}
        {series?.squeeze && <span className="ml-auto text-[12px] text-white/55">Anamorphic, {series.squeeze}x squeeze</span>}
      </div>

      {adding ? (
        <div className="mt-2.5 rounded-lg bg-white/5 p-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Your own lens set</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Rehoused Canon FD" className="mt-1.5 w-full rounded-md bg-white/10 px-2.5 py-1.5 text-sm placeholder:text-white/40 focus:outline-none" />
          <input value={list} onChange={(e) => setList(e.target.value)} inputMode="decimal" placeholder="Focal lengths, for example 24, 35, 50, 85" className="mt-1.5 w-full rounded-md bg-white/10 px-2.5 py-1.5 text-sm placeholder:text-white/40 focus:outline-none" />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="text-white/55">Squeeze</span>
            {["1", "1.33", "1.5", "1.8", "2"].map((v) => (
              <button key={v} type="button" onClick={() => setSq(v)} className={`rounded-full px-2.5 py-1 ${sq === v ? "bg-white font-semibold text-black" : "bg-white/10"}`}>{v === "1" ? "Spherical" : `${v}x`}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} disabled={!name.trim() || !typed.length} className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-40">
              Add {typed.length ? `${typed.length} ${typed.length === 1 ? "lens" : "lenses"}` : "set"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-md bg-white/10 px-3 py-1.5 text-sm">Cancel</button>
          </div>
          <p className="mt-1.5 text-[11px] text-white/45">Kept on this phone.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-2.5 text-[13px] font-semibold text-white/85">+ Add your own lens set</button>
      )}
    </div>
  );
}
