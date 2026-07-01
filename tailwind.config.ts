import type { Config } from "tailwindcss";

/**
 * Token-first Tailwind. Every color maps to a CSS variable defined in
 * app/globals.css, so light/dark are two value sets for the same tokens and
 * nothing is ever hardcoded. Do not add literal color values here.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // The token test page builds a few class names dynamically; keep them.
  safelist: [
    "bg-bg",
    "bg-surface",
    "bg-surface-2",
    "shadow-sm",
    "shadow-md",
    "shadow-lg",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-faint": "var(--text-faint)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-strong": "var(--accent-strong)",
        "accent-fg": "var(--accent-fg)",
        // Hue tokens (color-as-signal). Each has a saturated foreground and a
        // soft -bg tint, resolved per-theme.
        purple: "var(--h-purple)",
        "purple-bg": "var(--h-purple-bg)",
        indigo: "var(--h-indigo)",
        "indigo-bg": "var(--h-indigo-bg)",
        blue: "var(--h-blue)",
        "blue-bg": "var(--h-blue-bg)",
        cyan: "var(--h-cyan)",
        "cyan-bg": "var(--h-cyan-bg)",
        green: "var(--h-green)",
        "green-bg": "var(--h-green-bg)",
        yellow: "var(--h-yellow)",
        "yellow-bg": "var(--h-yellow-bg)",
        orange: "var(--h-orange)",
        "orange-bg": "var(--h-orange-bg)",
        pink: "var(--h-pink)",
        "pink-bg": "var(--h-pink-bg)",
        red: "var(--h-red)",
        "red-bg": "var(--h-red-bg)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
