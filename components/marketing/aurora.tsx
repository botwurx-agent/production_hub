/**
 * The gradient field behind the top of the page.
 *
 * Positions are taken from the Claude Design comp rather than reinvented, and
 * the one that matters is the FIELD: a fixed 1500x900 box, centred, pulled
 * 260px above the top edge. An earlier version placed the orbs in `vw` units
 * across the full width, which looks the same on a laptop and washes out
 * completely on a wide monitor, because the orbs drift apart until they stop
 * overlapping. The colour comes from them BLENDING, so they have to stay
 * clustered no matter how wide the window gets.
 *
 * Every colour is a token, so this follows the theme and the accent setting
 * instead of pinning the page to one palette.
 */
const ORBS = [
  { hue: "indigo", top: 60, left: 120, size: 460, opacity: 0.22, blur: 20 },
  { hue: "cyan", top: 0, right: 180, size: 420, opacity: 0.22, blur: 20 },
  { hue: "pink", top: 200, left: 690, size: 480, opacity: 0.18, blur: 24 },
  { hue: "orange", top: 280, right: 80, size: 360, opacity: 0.16, blur: 24 },
] as const;

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`sf-aurora ${className}`} aria-hidden="true">
      {/* Clipped by the parent, so a 1500px field never gives a narrow window a
          horizontal scrollbar. */}
      <div className="sf-aurora-field">
        {ORBS.map((o, i) => (
          <span
            key={i}
            className="sf-orb"
            style={{
              top: o.top,
              left: "left" in o ? o.left : undefined,
              right: "right" in o ? o.right : undefined,
              width: o.size,
              height: o.size,
              opacity: o.opacity,
              filter: `blur(${o.blur}px)`,
              background: `radial-gradient(circle, var(--h-${o.hue}), transparent 66%)`,
            }}
          />
        ))}
      </div>
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
