"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The scattered-tools picture: a job spread across seven places, arrows drawing
 * inward to one home.
 *
 * DRAWN AS ONE SVG SCENE rather than positioned divs with an arrow overlay.
 * The arrows have to land exactly on the chips at every width, and the moment
 * chips are laid out by CSS their positions are only knowable by measuring at
 * runtime. Inside a viewBox the coordinates are literal, so the whole thing
 * scales as one picture and the arrows cannot drift off their targets.
 *
 * The chips carry NAMES, not logos. Redrawing another company's mark from
 * memory produces an inaccurate imitation of a trademark and looks like one;
 * when real logo SVGs exist they slot into the same <g> without moving
 * anything. The colours are for telling seven chips apart, not brand accuracy.
 */

const CX = 450;
const CY = 236;

type Tool = { name: string; hue: string; x: number; y: number };

// Positioned by hand around the mark. Kept clear of the viewBox edges so a chip
// is never clipped, and off the mark itself so no arrow has to cross a label.
const TOOLS: Tool[] = [
  { name: "Gmail", hue: "red", x: 128, y: 62 },
  { name: "Slack", hue: "purple", x: 96, y: 236 },
  { name: "Drive", hue: "cyan", x: 128, y: 410 },
  { name: "Figma", hue: "pink", x: 772, y: 62 },
  { name: "Dropbox", hue: "blue", x: 804, y: 236 },
  { name: "Sheets", hue: "green", x: 772, y: 410 },
  { name: "Notion", hue: "amber", x: 450, y: 46 },
];

const CHIP_W = 132;
const CHIP_H = 44;

/** Stop the arrow short of the mark so the head is not buried under it. */
function arrowPath(t: Tool): string {
  const fromX = t.x + (t.x < CX ? CHIP_W / 2 : t.x > CX ? -CHIP_W / 2 : 0);
  const fromY = t.x === CX ? t.y + CHIP_H / 2 : t.y;

  const dx = CX - fromX;
  const dy = CY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const gap = 92;
  const toX = CX - (dx / len) * gap;
  const toY = CY - (dy / len) * gap;

  // A gentle bow, so seven straight lines do not read as a starburst.
  const mx = (fromX + toX) / 2 + dy * 0.1;
  const my = (fromY + toY) / 2 - dx * 0.1;
  return `M ${fromX} ${fromY} Q ${mx} ${my} ${toX} ${toY}`;
}

export function ScatterConverge() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      // Fires once the section is properly in view rather than as its top edge
      // grazes the fold, so the drawing is not already over when you get there.
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <div ref={ref} className={`sf-draw ${seen ? "is-in" : ""}`}>
      <svg
        viewBox="0 0 900 472"
        className="h-auto w-full"
        role="img"
        aria-label="A job spread across Gmail, Slack, Drive, Figma, Dropbox, Sheets and Notion, all converging on Studio Flows."
      >
        <defs>
          <marker
            id="sf-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--text-faint)" />
          </marker>
        </defs>

        {TOOLS.map((t, i) => (
          <path
            key={`arrow-${t.name}`}
            className="sf-arrow"
            d={arrowPath(t)}
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth="1.6"
            strokeLinecap="round"
            markerEnd="url(#sf-arrowhead)"
            // Staggered so the eye follows them inward one at a time instead of
            // seven lines snapping on together.
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}

        {TOOLS.map((t) => (
          <g key={t.name}>
            <rect
              x={t.x - CHIP_W / 2}
              y={t.y - CHIP_H / 2}
              width={CHIP_W}
              height={CHIP_H}
              rx="12"
              fill="var(--surface)"
              stroke={`var(--h-${t.hue})`}
              strokeWidth="1.5"
            />
            <circle cx={t.x - CHIP_W / 2 + 22} cy={t.y} r="7" fill={`var(--h-${t.hue})`} />
            <text
              x={t.x - CHIP_W / 2 + 40}
              y={t.y + 5}
              className="font-body"
              fontSize="15"
              fontWeight="600"
              fill="var(--text)"
            >
              {t.name}
            </text>
          </g>
        ))}

        {/* The one home everything points at. */}
        <rect
          x={CX - 62}
          y={CY - 62}
          width="124"
          height="124"
          rx="30"
          fill="var(--accent)"
        />
        <text
          x={CX}
          y={CY + 15}
          textAnchor="middle"
          className="font-display"
          fontSize="44"
          fontWeight="800"
          fill="var(--accent-fg)"
        >
          SF
        </text>
      </svg>
    </div>
  );
}
