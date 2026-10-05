"use client";

// Small controls shared by the Scene Setup prototype's panels.
import { useEffect, useState } from "react";
import type React from "react";

export function Thumb({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="relative h-[68px] w-[120px] overflow-hidden rounded-[8px] bg-[#1b1c1f]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-white/45">No {label.toLowerCase()} yet</div>
      )}
      <span className="absolute bottom-1 left-1 rounded-[5px] bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">{label}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-text-muted">{label}</p>
      {children}
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] border px-2 py-1 text-xs font-semibold transition ${
        on ? "border-accent bg-accent text-accent-fg" : "border-border text-text hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

export function Readout({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-xs text-text-muted">{k}</span>
      <span className="text-right text-sm font-semibold">{v}</span>
    </div>
  );
}

export function Info({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-base font-bold">{title}</h2>
      {lines.map((l) => <p key={l} className="text-sm text-text-muted">{l}</p>)}
    </div>
  );
}

export function RailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function RailItem({ active, onClick, dot, label, sub, onDelete, deleteLabel }: {
  active: boolean; onClick: () => void; dot: string; label: string; sub: string; onDelete?: () => void; deleteLabel?: string;
}) {
  return (
    <div className={`group relative flex items-start rounded-[10px] transition ${active ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
        <span className="min-w-0">
          <span className={`block truncate text-sm font-semibold ${active ? "text-accent" : ""}`}>{label}</span>
          <span className="block truncate text-xs text-text-muted">{sub}</span>
        </span>
      </button>
      {onDelete ? (
        // Shown on hover and on the selected row, so a row you are looking at
        // always says how to get rid of it.
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel ?? `Delete ${label}`}
          title={deleteLabel ?? `Delete ${label}`}
          className={`mr-1 mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-text-muted hover:bg-surface hover:text-text ${
            active ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100"
          }`}
        >
          <TrashIcon />
        </button>
      ) : null}
    </div>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8L12 4M6.8 7v4.2M9.2 7v4.2" />
    </svg>
  );
}

export function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="flex rounded-[10px] border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-[8px] px-2.5 py-1 text-xs font-semibold transition ${value === o.v ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint ? `${label} (${hint})` : label}
      className={`rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold transition ${
        on ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * A measurement typed in the units the setup is using (feet or metres) and
 * kept in metres. It commits on Enter or when the box loses focus, so a half
 * typed "1." is never applied as one metre.
 */
export function NumField({ label, value, units, onChange, min = 0, max = 100, compact }: {
  label: string; value: number; units: "ft" | "m"; onChange: (m: number) => void; min?: number; max?: number; compact?: boolean;
}) {
  const toU = (m: number) => (units === "ft" ? m / 0.3048 : m);
  const fmt = (m: number) => {
    const u = toU(m);
    return (Math.round(u * 100) / 100).toString();
  };
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, units, focused]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n)) {
      const m = units === "ft" ? n * 0.3048 : n;
      onChange(Math.max(min, Math.min(max, m)));
    } else setText(fmt(value));
  };
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${compact ? "" : "flex-1"}`}>
      <span className="text-[11px] font-semibold text-text-muted">{label}</span>
      <span className="flex items-center rounded-[8px] border border-border bg-surface pr-1.5 focus-within:border-accent">
        <input
          aria-label={label}
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commit(); }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setText(fmt(value)); (e.target as HTMLInputElement).blur(); }
            e.stopPropagation();
          }}
          className="w-full min-w-0 bg-transparent px-2 py-1 text-sm text-text focus:outline-none"
        />
        <span className="text-[11px] text-text-faint">{units}</span>
      </span>
    </label>
  );
}
