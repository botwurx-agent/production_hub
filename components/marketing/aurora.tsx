/**
 * The gradient field behind the hero.
 *
 * Four blurred orbs in the product's own hue tokens plus an accent wash from
 * the top edge, straight out of the design comp. Because every colour is a
 * token rather than a literal, this follows the theme and the accent setting
 * instead of pinning the page to one palette.
 *
 * Positions are percentages, not pixels, so the field scales with the section
 * rather than bunching into the corner on a wide monitor.
 */
const ORBS = [
  { hue: "indigo", top: "4%", left: "6%", size: "34vw", max: 480, opacity: 0.22 },
  { hue: "cyan", top: "0%", right: "10%", size: "30vw", max: 440, opacity: 0.2 },
  { hue: "pink", top: "26%", left: "44%", size: "34vw", max: 500, opacity: 0.16 },
  { hue: "orange", top: "34%", right: "4%", size: "26vw", max: 380, opacity: 0.15 },
] as const;

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`sf-aurora ${className}`} aria-hidden="true">
      {ORBS.map((o, i) => (
        <span
          key={i}
          className="sf-orb"
          style={{
            top: o.top,
            left: "left" in o ? o.left : undefined,
            right: "right" in o ? o.right : undefined,
            width: `min(${o.size}, ${o.max}px)`,
            height: `min(${o.size}, ${o.max}px)`,
            opacity: o.opacity,
            background: `radial-gradient(circle, var(--h-${o.hue}), transparent 66%)`,
          }}
        />
      ))}
    </div>
  );
}

/** A single soft wash for a band that wants lift without the full field. */
export function Wash({ hue }: { hue: string }) {
  return (
    <div
      className="sf-wash"
      aria-hidden="true"
      style={{
        background: `radial-gradient(ellipse 70% 80% at 50% 25%, var(--h-${hue}-bg), transparent 70%)`,
      }}
    />
  );
}
