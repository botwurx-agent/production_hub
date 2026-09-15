import { MARK_BOX, MARK_PATH, MARK_RADIUS, MARK_SCALE, MARK_STROKE } from "@/lib/brand-mark";

/**
 * The mark on its own, in currentColor, so it inherits whatever it sits in and
 * recolours with the theme instead of carrying a hardcoded indigo.
 *
 * The viewBox is the bare 100-unit grid and needs no padding: the round caps
 * reach x 4.5 to 95.5 and y 18.5 to 81.5, so the ink is already inside the box
 * and already centred on it. Add padding here and every tile that sizes this
 * by MARK_SCALE silently shrinks.
 */
export function StudioMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_BOX} ${MARK_BOX}`}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      fill="none"
    >
      {title ? <title>{title}</title> : null}
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={MARK_STROKE} strokeLinecap="round" />
    </svg>
  );
}

/**
 * The mark reversed out of an accent tile. The sidebar chip, the mobile topbar,
 * the nav and the footer all use this, so the rounded square exists once and
 * the mark sits at the same inset here as on the generated favicon.
 */
export function StudioTile({ size = 32, className }: { size?: number; className?: string }) {
  const mark = size * MARK_SCALE;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * MARK_RADIUS,
        backgroundColor: "var(--accent)",
        color: "var(--accent-fg)",
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <span style={{ width: mark, height: mark, display: "flex" }}>
        <StudioMark className="block h-full w-full" title="Studio Flows" />
      </span>
    </span>
  );
}
