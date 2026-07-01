export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type Accent = "indigo" | "purple" | "blue" | "pink" | "orange";

export const THEME_STORAGE_KEY = "mk_theme";
export const ACCENT_STORAGE_KEY = "mk_accent";
export const DEFAULT_ACCENT: Accent = "indigo";

/**
 * Runs before first paint (injected into <head>) so the correct theme and
 * accent are applied to <html> synchronously, preventing a flash. Kept as a
 * plain string with no external references so it can be inlined verbatim.
 */
export const themeInitScript = `
(function () {
  try {
    var root = document.documentElement;
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (systemDark ? 'dark' : 'light');
    root.setAttribute('data-theme', theme);

    var accent = localStorage.getItem('${ACCENT_STORAGE_KEY}') || '${DEFAULT_ACCENT}';
    root.setAttribute('data-accent', accent);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-accent', '${DEFAULT_ACCENT}');
  }
})();
`;
