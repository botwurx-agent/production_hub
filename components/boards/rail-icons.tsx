/**
 * The board rail's tool drawings.
 *
 * WHY THESE ARE NOT PLAIN GLYPHS. The rail used to carry 19px single-stroke
 * outline icons, the same weight and colour as every other icon in the app.
 * That is right for a nav row, where an icon is a label. It is wrong here,
 * because these are the things you MAKE, and the operator read the thinness as
 * lower quality next to Milanote's tray.
 *
 * So each one is a small drawing of the card it creates rather than a symbol
 * for it: a note has ruled lines and a folded corner, a to-do has ticked rows,
 * a column has cards stacked inside it. Each uses two weights (a filled body in
 * the hue's soft tint, a stroked outline in the hue itself) so it reads as an
 * object with substance instead of a wireframe.
 *
 * Colour here is IDENTITY, not status, which is the distinction section 4.2
 * draws: these ride on the same IconTile the rest of the app uses for module
 * wayfinding, so the rail looks like it belongs to this product.
 *
 * Drawn on a 24x24 grid so they line up with the app's other icons, and using
 * currentColor plus a `soft` fill so both themes work with no second palette.
 */

const soft = "color-mix(in oklch, currentColor 18%, transparent)";
const softer = "color-mix(in oklch, currentColor 10%, transparent)";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const RAIL_ART: Record<string, React.ReactNode> = {
  // A page with a turned corner and ruled lines.
  note: (
    <Svg>
      <path d="M5 4.5h9l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" fill={soft} />
      <path d="M14 4.5v5h5" />
      <path d="M7.5 13h9M7.5 16.5h6" />
    </Svg>
  ),
  // A big line over a small one: the shape of a headline above body copy.
  heading: (
    <Svg>
      <rect x="3.5" y="5" width="17" height="5.5" rx="1.5" fill={soft} />
      <path d="M6 15h12M6 18.5h8" />
    </Svg>
  ),
  // A card with two ticked rows.
  todo: (
    <Svg>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" fill={soft} />
      <path d="M7 9.5l1.6 1.6L11.5 8" />
      <path d="M7 15.5l1.6 1.6L11.5 14" />
      <path d="M14 10h4M14 16h4" />
    </Svg>
  ),
  // A frame with cards filed inside it.
  column: (
    <Svg>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" fill={softer} />
      <rect x="7" y="7" width="10" height="4" rx="1.2" fill={soft} />
      <rect x="7" y="13" width="10" height="4" rx="1.2" fill={soft} />
    </Svg>
  ),
  // Two clean forms, not three. An earlier version overlapped a square, a
  // circle and a triangle, which at 22px stopped reading as shapes at all and
  // became a smudge: at this size an icon can carry two silhouettes, no more.
  shape: (
    <Svg>
      <rect x="3.5" y="9" width="11" height="11" rx="2" fill={soft} />
      <circle cx="16" cy="8" r="4.5" />
    </Svg>
  ),
  // A connector: two anchors and an arrow between them.
  line: (
    <Svg>
      <circle cx="5.5" cy="18.5" r="2" fill={soft} />
      <path d="M7.5 16.5 16 8" />
      <path d="M11.5 6.5H18V13" />
    </Svg>
  ),
  // A chain plus the preview card an unfurl produces.
  link: (
    <Svg>
      <rect x="3.5" y="6" width="9" height="12" rx="2" fill={soft} />
      <path d="M13.5 9.5a4 4 0 0 1 5.5 5.5l-1.7 1.7a4 4 0 0 1-5.6-5.6" />
    </Svg>
  ),
  // A play badge on a frame.
  video: (
    <Svg>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill={soft} />
      <path d="m10 9 5.5 3-5.5 3V9z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  // A photograph: horizon, sun, frame.
  image: (
    <Svg>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill={soft} />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 19" />
    </Svg>
  ),
  // A stack of swatches.
  color: (
    <Svg>
      <rect x="3.5" y="8" width="11" height="11" rx="2" fill={soft} />
      <path d="M7.5 5.5h10a2 2 0 0 1 2 2v10" />
    </Svg>
  ),
  // Layered sheets: the project's own library.
  assets: (
    <Svg>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" fill={soft} />
      <path d="M3 16.5 12 21l9-4.5M3 12l9 4.5L21 12" />
    </Svg>
  ),
  drive: (
    <Svg>
      <path d="M8.5 3.5h7l5 9h-7z" fill={soft} />
      <path d="M3.5 20.5 7 14h11l-3.5 6.5zM8.5 3.5 3.5 12.5" />
    </Svg>
  ),
  figma: (
    <Svg>
      <rect x="4.5" y="4" width="15" height="16" rx="2.5" fill={soft} />
      <path d="M4.5 9.5h15M9.5 4v16" />
    </Svg>
  ),
};
