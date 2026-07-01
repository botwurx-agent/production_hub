import type { ReactNode } from "react";

/**
 * Color-as-signal chip: a tinted background with a small solid dot and the
 * saturated hue for text. Small and contained, never a full colored row.
 * Hue names map directly to the design-token hues.
 */
export type Hue =
  | "purple"
  | "indigo"
  | "blue"
  | "cyan"
  | "green"
  | "yellow"
  | "orange"
  | "pink"
  | "red";

const hueStyles: Record<Hue, { bg: string; fg: string }> = {
  purple: { bg: "var(--h-purple-bg)", fg: "var(--h-purple)" },
  indigo: { bg: "var(--h-indigo-bg)", fg: "var(--h-indigo)" },
  blue: { bg: "var(--h-blue-bg)", fg: "var(--h-blue)" },
  cyan: { bg: "var(--h-cyan-bg)", fg: "var(--h-cyan)" },
  green: { bg: "var(--h-green-bg)", fg: "var(--h-green)" },
  yellow: { bg: "var(--h-yellow-bg)", fg: "var(--h-yellow)" },
  orange: { bg: "var(--h-orange-bg)", fg: "var(--h-orange)" },
  pink: { bg: "var(--h-pink-bg)", fg: "var(--h-pink)" },
  red: { bg: "var(--h-red-bg)", fg: "var(--h-red)" },
};

export function StatusTag({
  hue,
  children,
  dot = true,
  className = "",
}: {
  hue: Hue;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const { bg, fg } = hueStyles[hue];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${className}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: fg }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
