"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ACCENT_STORAGE_KEY,
  Accent,
  DEFAULT_ACCENT,
  ResolvedTheme,
  THEME_STORAGE_KEY,
  ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  accent: Accent;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
  setAccent: (accent: Accent) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function readStoredAccent(): Accent {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  return (localStorage.getItem(ACCENT_STORAGE_KEY) as Accent) || DEFAULT_ACCENT;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT);

  // Hydrate from what the pre-paint script already applied.
  useEffect(() => {
    setPreferenceState(readStoredPreference());
    setAccentState(readStoredAccent());
    const current = document.documentElement.getAttribute(
      "data-theme"
    ) as ResolvedTheme | null;
    setResolved(current ?? systemTheme());
  }, []);

  const applyResolved = useCallback((pref: ThemePreference) => {
    const next = pref === "system" ? systemTheme() : pref;
    document.documentElement.setAttribute("data-theme", next);
    setResolved(next);
  }, []);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      if (pref === "system") {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, pref);
      }
      applyResolved(pref);
    },
    [applyResolved]
  );

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    localStorage.setItem(ACCENT_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-accent", next);
  }, []);

  // Live-update when the system preference changes and no manual choice is set.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyResolved("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference, applyResolved]);

  return (
    <ThemeContext.Provider
      value={{ preference, resolved, accent, setPreference, toggle, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
