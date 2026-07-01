"use client";

import { useTheme } from "@/components/theme-provider";
import type { Accent, ThemePreference } from "@/lib/theme";

const themes: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const accents: Accent[] = ["indigo", "purple", "blue", "pink", "orange"];

export function Appearance() {
  const { preference, accent, setPreference, setAccent } = useTheme();

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-semibold text-text-muted">Theme</div>
        <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setPreference(t.value)}
              className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                preference === t.value
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-faint">
          System follows your device. Your choice is remembered on this browser.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-text-muted">
          Brand accent
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accents.map((a) => (
            <button
              key={a}
              onClick={() => setAccent(a)}
              aria-label={`Use ${a} accent`}
              className={`flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                accent === a
                  ? "border-accent text-accent"
                  : "border-border text-text-muted hover:text-text"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: `var(--h-${a})` }}
              />
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
