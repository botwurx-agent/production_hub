"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";

// Three themes means this can no longer be a two-state flip, so it is a small
// menu. Paper is the warm neutral: the same light palette with the blue taken
// out, for people who find a cold white tiring over a long review.

const SUN = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const PAGE = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

const MOON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SCREEN = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const OPTIONS: {
  key: ThemePreference;
  label: string;
  hint: string;
  icon: JSX.Element;
}[] = [
  { key: "light", label: "Light", hint: "Cool and bright", icon: SUN },
  { key: "paper", label: "Paper", hint: "Warm, easier on the eyes", icon: PAGE },
  { key: "dark", label: "Dark", hint: "Low light", icon: MOON },
  { key: "system", label: "System", hint: "Follow this device", icon: SCREEN },
];

const ICON_FOR: Record<ResolvedTheme, JSX.Element> = {
  light: SUN,
  paper: PAGE,
  dark: MOON,
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change theme"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-border bg-surface text-text-muted shadow-sm transition hover:border-border-strong hover:text-text"
      >
        {ICON_FOR[resolved] ?? SUN}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-[13px] border border-border bg-surface p-1 shadow-lg"
        >
          {OPTIONS.map((o) => {
            const active = preference === o.key;
            return (
              <button
                key={o.key}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setPreference(o.key);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-surface-2 ${
                  active ? "bg-surface-2" : ""
                }`}
              >
                <span className="mt-0.5 shrink-0 text-text-muted">{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">
                    {o.label}
                  </span>
                  <span className="block text-xs text-text-faint">{o.hint}</span>
                </span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 text-accent" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
