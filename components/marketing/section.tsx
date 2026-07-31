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
  const bg =
    tint === "tinted"
      ? "bg-surface-2"
      : tint === "accent"
        ? "bg-accent-soft"
        : "bg-bg";
  return (
    <section className={`px-5 py-20 sm:py-28 ${bg} ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
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
    align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl text-left";
  return (
    <div className={wrap}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
        {title}
      </h2>
      {sub ? (
        <p className="mt-4 text-lg leading-relaxed text-text-muted">{sub}</p>
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
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>{children}</div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}
