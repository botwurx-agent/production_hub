"use client";

// Small controls shared by the Scene Setup prototype's panels.
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

export function RailItem({ active, onClick, dot, label, sub }: { active: boolean; onClick: () => void; dot: string; label: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-[10px] px-2 py-1.5 text-left transition ${active ? "bg-accent-soft" : "hover:bg-surface-2"}`}
    >
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="min-w-0">
        <span className={`block truncate text-sm font-semibold ${active ? "text-accent" : ""}`}>{label}</span>
        <span className="block truncate text-xs text-text-muted">{sub}</span>
      </span>
    </button>
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
