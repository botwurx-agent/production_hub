"use client";

// Shot blocking: compact controls for a dense, dark tool. A number field
// behaves like a 3D app's: type a value, or drag sideways on its label to
// scrub it (shift for fine).
import { useEffect, useRef, useState } from "react";
import type React from "react";

/**
 * A neutral charcoal, darker than the app's own dark theme: a tool for looking
 * at pictures. Set with data-theme="dark". The accent pair is restated because
 * the app defines it on :root, where var() resolves against the page's own
 * theme rather than this panel's.
 */
export const STUDIO_VARS = {
  "--bg": "oklch(0.17 0.004 260)",
  "--surface": "oklch(0.205 0.005 260)",
  "--surface-2": "oklch(0.25 0.006 260)",
  "--border": "oklch(0.3 0.006 260)",
  "--border-strong": "oklch(0.4 0.008 260)",
  "--text": "oklch(0.94 0.004 260)",
  "--text-muted": "oklch(0.74 0.006 260)",
  "--text-faint": "oklch(0.58 0.008 260)",
  "--accent": "oklch(0.62 0.17 274)",
  "--accent-soft": "oklch(0.3 0.07 274)",
  "--accent-strong": "oklch(0.55 0.17 274)",
  "--accent-fg": "oklch(0.99 0.01 274)",
} as React.CSSProperties;

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b border-border px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">{title}</h3>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[68px_1fr] items-center gap-2">
      <span className="truncate text-[11.5px] text-text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Num({
  value, onChange, step = 0.1, min, max, suffix, label, digits = 2, disabled,
}: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
  suffix?: string; label?: string; digits?: number; disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<{ x: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = (s: string) => {
    const n = Number(s.replace(/[^\d.+-eE]/g, ""));
    if (s.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
    setText(null);
  };
  return (
    <div className={`flex h-7 min-w-0 items-center overflow-hidden rounded-[6px] border border-border bg-surface-2 ${disabled ? "opacity-50" : ""}`}>
      {label && (
        <span
          className="flex h-full cursor-ew-resize select-none items-center px-1.5 text-[10.5px] font-bold text-text-faint hover:text-text"
          onPointerDown={(e) => {
            if (disabled) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, v: value };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const k = e.shiftKey ? 0.1 : 1;
            onChange(clamp(d.v + ((e.clientX - d.x) / 4) * step * k));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {label}
        </span>
      )}
      <input
        disabled={disabled}
        className="h-full w-full min-w-0 bg-transparent px-1.5 text-right font-mono text-[11.5px] tabular-nums text-text outline-none"
        value={text ?? (Number.isFinite(value) ? value.toFixed(digits) : "")}
        onFocus={(e) => { setText(e.target.value); e.target.select(); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setText(null); (e.target as HTMLInputElement).blur(); }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
          }
        }}
      />
      {suffix && <span className="pr-1.5 text-[10.5px] text-text-faint">{suffix}</span>}
    </div>
  );
}

export function Vec({
  value, onChange, labels = ["X", "Y", "Z"], step = 0.1, digits = 2, disabled,
}: {
  value: [number, number, number]; onChange: (v: [number, number, number]) => void;
  labels?: string[]; step?: number; digits?: number; disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => (
        <Num key={i} label={labels[i]} value={value[i]} step={step} digits={digits} disabled={disabled}
          onChange={(v) => { const n = [...value] as [number, number, number]; n[i] = v; onChange(n); }} />
      ))}
    </div>
  );
}

export function Seg<T extends string>({
  value, options, onChange, disabled,
}: { value: T; options: { id: T; name: string; hint?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex rounded-[7px] border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`min-w-0 flex-1 truncate rounded-[5px] px-1.5 py-1 text-[11px] font-semibold transition ${
            value === o.id ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"
          }`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

export function Select({
  value, onChange, children, disabled,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      className="h-7 w-full min-w-0 rounded-[6px] border border-border bg-surface-2 px-1.5 text-[11.5px] text-text outline-none"
    >
      {children}
    </select>
  );
}

export function Btn({
  children, onClick, tone = "plain", disabled, title, active, className = "",
}: {
  children: React.ReactNode; onClick?: () => void; tone?: "plain" | "primary" | "danger" | "rec";
  disabled?: boolean; title?: string; active?: boolean; className?: string;
}) {
  const t =
    tone === "primary" ? "border-accent bg-accent text-accent-fg hover:brightness-110"
      : tone === "danger" ? "border-border text-red hover:border-red"
        : tone === "rec" ? (active ? "border-red bg-red text-white" : "border-border text-text-muted hover:text-text")
          : active ? "border-accent bg-accent-soft text-text" : "border-border text-text-muted hover:border-border-strong hover:text-text";
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[11.5px] font-semibold transition disabled:opacity-40 ${t} ${className}`}>
      {children}
    </button>
  );
}

export function Swatches({ value, colors, onChange }: { value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} title={c}
          className={`h-5 w-5 rounded-full border ${value.toLowerCase() === c.toLowerCase() ? "border-text ring-2 ring-accent" : "border-border"}`}
          style={{ background: c }} />
      ))}
      <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-border" title="Any colour"
        style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  );
}

/** Closes when anything outside it is pressed. */
export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, close]);
  return ref;
}
