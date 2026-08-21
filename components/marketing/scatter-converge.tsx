"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_LOGOS } from "@/components/marketing/tool-logos";

/**
 * The scattered-tools picture: a job spread across eight places, arrows drawing
 * inward to one home.
 *
 * DRAWN AS ONE SVG SCENE rather than positioned divs with an arrow overlay.
 * The arrows have to land exactly on the chips at every width, and the moment
 * chips are laid out by CSS their positions are only knowable by measuring at
 * runtime. Inside a viewBox the coordinates are literal, so the whole thing
 * scales as one picture and the arrows cannot drift off their targets.
 */

const CX = 460;
const CY = 250;
const CHIP_W = 148;
const CHIP_H = 46;

/** Eight points around the mark: three down each side, one top, one bottom. */
const SLOTS: { x: number; y: number }[] = [
  { x: 118, y: 66 },
  { x: 86, y: 250 },
  { x: 118, y: 434 },
  { x: 802, y: 66 },
  { x: 834, y: 250 },
  { x: 802, y: 434 },
  { x: 330, y: 500 },
  { x: 590, y: 500 },
];

const TOOLS = TOOL_LOGOS.map((logo, i) => ({ ...logo, ...SLOTS[i] }));

/** Stop the arrow short of the mark so the head is not buried under it. */
function arrowPath(t: { x: number; y: number }): string {
  const horizontal = Math.abs(t.x - CX) > Math.abs(t.y - CY);
  const fromX = horizontal ? t.x + (t.x < CX ? CHIP_W / 2 : -CHIP_W / 2) : t.x;
  const fromY = horizontal ? t.y : t.y + (t.y < CY ? CHIP_H / 2 : -CHIP_H / 2);

  const dx = CX - fromX;
  const dy = CY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const gap = 96;
  const toX = CX - (dx / len) * gap;
  const toY = CY - (dy / len) * gap;

  // A gentle bow, so eight straight lines do not read as a starburst.
  const mx = (fromX + toX) / 2 + dy * 0.09;
  const my = (fromY + toY) / 2 - dx * 0.09;
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
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <div ref={ref} className={`sf-draw ${seen ? "is-in" : ""}`}>
      <svg
        viewBox="0 0 920 546"
        className="h-auto w-full"
        role="img"
        aria-label="A job spread across Gmail, Figma, Drive, Dropbox, Sheets, Notion, WeTransfer and WhatsApp, all converging on Studio Flows."
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
            key={`arrow-${t.label}`}
            className="sf-arrow"
            d={arrowPath(t)}
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth="1.6"
            strokeLinecap="round"
            markerEnd="url(#sf-arrowhead)"
            // Staggered so the eye follows them inward one at a time instead of
            // eight lines snapping on together.
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}

        {TOOLS.map((t) => {
          const left = t.x - CHIP_W / 2;
          const top = t.y - CHIP_H / 2;
          // Simple Icons paths are 24x24; 0.85 puts the mark at 20px inside a
          // 46px chip, optically centred against the label.
          const s = 0.85;
          const iconX = left + 16;
          const iconY = t.y - (24 * s) / 2;
          return (
            <g key={t.label}>
              <rect
                x={left}
                y={top}
                width={CHIP_W}
                height={CHIP_H}
                rx="12"
                fill="var(--surface)"
                stroke="var(--border-strong)"
                strokeWidth="1"
              />
              <g transform={`translate(${iconX} ${iconY}) scale(${s})`}>
                <path d={t.path} fill={t.hex} />
              </g>
              <text
                x={left + 46}
                y={t.y + 5}
                className="font-body"
                fontSize="15"
                fontWeight="600"
                fill="var(--text)"
              >
                {t.label}
              </text>
            </g>
          );
        })}

        {/* The one home everything points at. */}
        <rect
          x={CX - 64}
          y={CY - 64}
          width="128"
          height="128"
          rx="30"
          fill="var(--accent)"
        />
        <text
          x={CX}
          y={CY + 16}
          textAnchor="middle"
          className="font-display"
          fontSize="46"
          fontWeight="800"
          fill="var(--accent-fg)"
        >
          SF
        </text>
      </svg>
    </div>
  );
}
