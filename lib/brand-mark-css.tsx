import { MARK_BARS, MARK_BOX, MARK_RADIUS, MARK_SCALE } from "@/lib/brand-mark";

/**
 * The mark drawn as three rounded divs, for the SATORI routes only (app/icon,
 * app/apple-icon, lib/marketing/og). Satori renders a subset of CSS and cannot
 * be relied on for inline SVG, and a broken image route fails as a 500, which
 * surfaces as a share with no picture and nothing visibly wrong on the page. So
 * the generated surfaces use layout primitives Satori is known to handle.
 *
 * It reads the same MARK_BARS the SVG path is built from, so the favicon cannot
 * drift from the chip in the nav. In the app and on the marketing site use
 * components/brand/studio-mark instead.
 */
export function MarkCss({ size, color }: { size: number; color: string }) {
  const px = (units: number) => (units / MARK_BOX) * size;
  return (
    <div style={{ position: "relative", display: "flex", width: size, height: size }}>
      {MARK_BARS.map((bar, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px(bar.left),
            top: px(bar.top),
            width: px(bar.width),
            height: px(bar.height),
            borderRadius: px(bar.height) / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

/** The mark reversed out of a rounded accent tile, at the shared proportions. */
export function TileCss({
  size,
  bg,
  fg,
  rounded = true,
}: {
  size: number;
  bg: string;
  fg: string;
  rounded?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderRadius: rounded ? size * MARK_RADIUS : 0,
      }}
    >
      <MarkCss size={size * MARK_SCALE} color={fg} />
    </div>
  );
}
