import type { ReactNode } from "react";

/**
 * One idea per section, with generous vertical air and alternating tint. The
 * rhythm is the argument: a site that reads as organized is the first evidence
 * that the product will organize you.
 */
export function Section({
  tint = "plain",
  className = "",
  children,
}: {
  tint?: "plain" | "tinted" | "accent";
  className?: string;
  children: ReactNode;
}) {
  // Tinted bands carry a soft vertical gradient rather than one flat fill, so a
  // long scroll has some depth instead of reading as alternating grey slabs.
  const bg =
    tint === "tinted"
      ? "bg-gradient-to-b from-surface-2 via-surface-2 to-bg"
      : tint === "accent"
        ? "bg-gradient-to-b from-accent-soft via-accent-soft to-bg"
        : "bg-bg";
  return (
    <section className={`px-6 py-24 sm:px-10 sm:py-32 ${bg} ${className}`}>
      {/* 1400px, not 1152px: on a 1920 screen the old container left 40% of the
          page as dead margin, which is what made every section read as narrow. */}
      <div className="mx-auto w-full max-w-[1400px]">{children}</div>
    </section>
  );
}

/** Centered section heading: eyebrow, title, one supporting line. */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  const wrap =
    align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl text-left";
  return (
    <div className={wrap}>
      {eyebrow ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {sub ? (
        <p className="mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A feature row: copy on one side, product shot on the other. Alternate
 * `flip` down the page so the eye keeps moving.
 */
export function FeatureRow({
  flip = false,
  children,
  visual,
}: {
  flip?: boolean;
  children: ReactNode;
  visual: ReactNode;
}) {
  return (
    // The visual gets the larger share (6/5 of the grid), so the product shot
    // reads as the subject and the copy as its caption, not the reverse.
    <div className="grid items-center gap-14 lg:grid-cols-11 lg:gap-20">
      <div className={`lg:col-span-5 ${flip ? "lg:order-2" : ""}`}>
        {children}
      </div>
      <div className={`lg:col-span-6 ${flip ? "lg:order-1" : ""}`}>{visual}</div>
    </div>
  );
}
