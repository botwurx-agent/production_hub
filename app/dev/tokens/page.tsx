"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { StatusTag, type Hue } from "@/components/status-tag";
import { useTheme } from "@/components/theme-provider";
import type { Accent } from "@/lib/theme";

const hues: Hue[] = [
  "indigo",
  "purple",
  "blue",
  "cyan",
  "green",
  "yellow",
  "orange",
  "pink",
  "red",
];

const surfaces = [
  { name: "--bg", token: "bg" },
  { name: "--surface", token: "surface" },
  { name: "--surface-2", token: "surface-2" },
];

const textTokens = [
  { name: "--text", cls: "text-text" },
  { name: "--text-muted", cls: "text-text-muted" },
  { name: "--text-faint", cls: "text-text-faint" },
];

const accents: Accent[] = ["indigo", "purple", "blue", "pink", "orange"];

export default function TokenTestPage() {
  const { resolved, preference, accent, setAccent, setPreference } = useTheme();

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-10">
      {/* Header */}
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-fg shadow-md">
              <span className="text-xs font-extrabold tracking-tight">SF</span>
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">
              Studio Flows
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Token &amp; theme test page. Resolved theme:{" "}
            <span className="font-semibold text-text">{resolved}</span>{" "}
            (preference: {preference}), accent:{" "}
            <span className="font-semibold text-text">{accent}</span>.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Controls */}
      <section className="mb-10 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
          {(["system", "light", "dark"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreference(p)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold capitalize transition ${
                preference === p
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm">
          {accents.map((a) => (
            <button
              key={a}
              onClick={() => setAccent(a)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold capitalize transition ${
                accent === a
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="mb-12">
        <SectionLabel>Typography</SectionLabel>
        <div className="rounded-[18px] border border-border bg-surface p-8 shadow-sm">
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.03em]">
            Every brief, version &amp; approval, in one home.
          </h1>
          <h2 className="mt-6 font-display text-3xl font-extrabold tracking-[-0.028em]">
            Plus Jakarta Sans carries the display hierarchy
          </h2>
          <p className="mt-4 max-w-2xl font-body text-lg leading-relaxed text-text-muted">
            Hanken Grotesk carries body and UI text. Typography and whitespace
            carry the structure: the project name is the hero, client and dates
            sit quieter beneath.
          </p>
          <div className="mt-6 flex flex-wrap gap-6">
            {textTokens.map((t) => (
              <span key={t.name} className={`text-sm font-medium ${t.cls}`}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Surfaces */}
      <section className="mb-12">
        <SectionLabel>Surfaces &amp; borders</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {surfaces.map((s) => (
            <div
              key={s.name}
              className={`rounded-[16px] border border-border bg-${s.token} p-6 shadow-sm`}
            >
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="mt-8 flex gap-2">
                <span className="rounded-md border border-border px-2 py-1 text-xs text-text-muted">
                  border
                </span>
                <span className="rounded-md border border-border-strong px-2 py-1 text-xs text-text-muted">
                  border-strong
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Shadows */}
      <section className="mb-12">
        <SectionLabel>Elevation</SectionLabel>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {(["sm", "md", "lg"] as const).map((s) => (
            <div
              key={s}
              className={`rounded-[16px] bg-surface p-6 shadow-${s}`}
            >
              <div className="text-sm font-semibold">shadow-{s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Color as signal */}
      <section className="mb-12">
        <SectionLabel>Color as signal (status chips)</SectionLabel>
        <div className="flex flex-wrap gap-3 rounded-[18px] border border-border bg-surface p-8 shadow-sm">
          {hues.map((h) => (
            <StatusTag key={h} hue={h}>
              {h.charAt(0).toUpperCase() + h.slice(1)}
            </StatusTag>
          ))}
        </div>
      </section>

      {/* Hue swatches */}
      <section className="mb-12">
        <SectionLabel>Hue tokens</SectionLabel>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
          {hues.map((h) => (
            <div key={h} className="text-center">
              <div
                className="mb-2 h-16 rounded-[14px] shadow-sm"
                style={{ backgroundColor: `var(--h-${h})` }}
              />
              <div
                className="h-8 rounded-[10px] border border-border"
                style={{ backgroundColor: `var(--h-${h}-bg)` }}
              />
              <div className="mt-2 text-xs font-medium text-text-muted">{h}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-12">
        <SectionLabel>Actions</SectionLabel>
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border bg-surface p-8 shadow-sm">
          <button className="rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong">
            Primary action
          </button>
          <button className="rounded-[12px] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text transition hover:border-accent hover:text-accent">
            Secondary
          </button>
          <button className="rounded-[12px] px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent-soft">
            Ghost
          </button>
        </div>
      </section>

      {/* Sample project card */}
      <section className="mb-4">
        <SectionLabel>Sample card (color-as-signal in context)</SectionLabel>
        <div className="max-w-sm rounded-[18px] border border-border bg-surface p-5 shadow-md">
          <div className="mb-3 flex items-start justify-between">
            <StatusTag hue="orange">Shoot</StatusTag>
            <span className="text-xs text-text-faint">Due Jul 14</span>
          </div>
          <h3 className="font-display text-lg font-bold">Bolt Energy: Hero film</h3>
          <p className="mt-1 text-sm text-text-muted">Meridian Agency</p>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex -space-x-2">
              {["indigo", "green", "pink"].map((c) => (
                <span
                  key={c}
                  className="h-7 w-7 rounded-full border-2 border-surface"
                  style={{ backgroundColor: `var(--h-${c})` }}
                />
              ))}
            </div>
            <StatusTag hue="red" className="ml-auto">
              1 approval pending
            </StatusTag>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.05em] text-text-faint">
      {children}
    </h2>
  );
}
