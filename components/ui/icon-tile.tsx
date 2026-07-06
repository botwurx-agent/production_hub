import type { ReactNode } from "react";

// A colored, rounded icon tile used for module/section identity across the app.
// Color here is identity (wayfinding), kept distinct from status chips.
export function IconTile({
  hue,
  size = "md",
  children,
}: {
  hue: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const dims =
    size === "lg"
      ? "h-12 w-12 rounded-[13px]"
      : size === "sm"
        ? "h-8 w-8 rounded-[9px]"
        : "h-10 w-10 rounded-[11px]";
  return (
    <span
      className={`grid shrink-0 place-items-center ${dims}`}
      style={{
        backgroundColor: `var(--h-${hue}-bg)`,
        color: `var(--h-${hue})`,
      }}
    >
      {children}
    </span>
  );
}
