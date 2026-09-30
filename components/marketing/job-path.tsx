"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The job's path, drawn by the reader's own scroll. Adapted from the
 * self-drawing workflow on monday.com's home page (docs/competitor-research/
 * monday.md), where a trigger, a line, a decision and two branches appear one
 * after another as you scroll. Ours is the thing a producer actually lives
 * through: brief, storyboard, client review (which can send it back), schedule,
 * call sheet, delivery, invoice.
 *
 * SCROLL-SCRUBBED, NOT TRIGGERED, which is the half of the reference that
 * matters: the section is tall, its inner stage is sticky, and how far the
 * reader has scrolled through the section IS how much of the path exists. So
 * the reader sets the pace, scrolling back rewinds it, and it cannot finish
 * while somebody is still reading the headline.
 *
 * The stage is laid out once in fixed logical units (STAGE_W x STAGE_H) and
 * scaled to whatever room it has, so the diagram is one drawing at every width
 * rather than a layout that reflows its arrows. Reduced motion gets the whole
 * path, drawn, with no scroll dependence at all.
 */

const STAGE_W = 720;
const STAGE_H = 900;

type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  label: string;
  sub: string;
  hue: string;
  /** Progress (0 to 1) at which it appears. */
  t: number;
  icon: keyof typeof ICONS;
  /** The status it lands on, shown a beat after the node appears. */
  chip?: { text: string; hue: string; t: number };
};

const NODES: Node[] = [
  { id: "brief", x: 360, y: 50, w: 250, label: "Brief", sub: "Hint, Treat Yourself", hue: "indigo", t: 0.02, icon: "brief" },
  { id: "board", x: 360, y: 165, w: 250, label: "Storyboard", sub: "12 frames, 4:5", hue: "purple", t: 0.12, icon: "board" },
  {
    id: "review", x: 360, y: 285, w: 250, label: "Client review", sub: "Maya pinned 3 notes", hue: "pink", t: 0.23, icon: "pin",
    chip: { text: "Round 2", hue: "pink", t: 0.46 },
  },
  { id: "changes", x: 165, y: 410, w: 200, label: "Changes requested", sub: "Warmer on the bottle", hue: "amber", t: 0.33, icon: "loop" },
  {
    id: "approved", x: 555, y: 410, w: 200, label: "Approved", sub: "Signed off by the client", hue: "green", t: 0.5, icon: "check",
  },
  {
    id: "schedule", x: 360, y: 535, w: 250, label: "Schedule", sub: "Day 1 wraps 5:00 PM", hue: "green", t: 0.6, icon: "clock",
    chip: { text: "On target", hue: "green", t: 0.66 },
  },
  {
    id: "call", x: 360, y: 650, w: 250, label: "Call sheet", sub: "Sent to 12 crew", hue: "amber", t: 0.7, icon: "sheet",
    chip: { text: "12/12", hue: "green", t: 0.76 },
  },
  { id: "delivery", x: 360, y: 765, w: 250, label: "Delivery", sub: "Final cut, v3", hue: "blue", t: 0.8, icon: "film" },
  {
    id: "invoice", x: 360, y: 870, w: 250, label: "Invoice", sub: "INV-1042, $42,000", hue: "indigo", t: 0.89, icon: "invoice",
    chip: { text: "Sent", hue: "green", t: 0.95 },
  },
];

/** Connectors, in stage units. `t` is when it starts drawing. */
const EDGES: { d: string; t: number; dash?: boolean; hue?: string; label?: { x: number; y: number; text: string } }[] = [
  { d: "M360 72 V143", t: 0.06 },
  { d: "M360 187 V263", t: 0.17 },
  { d: "M300 307 C 230 330 165 340 165 388", t: 0.28, hue: "amber", label: { x: 205, y: 330, text: "Changes" } },
  // Back to the storyboard: the loop every producer knows.
  { d: "M65 410 C 10 410 10 165 235 165", t: 0.4, dash: true, hue: "amber", label: { x: 40, y: 290, text: "Revise" } },
  { d: "M420 307 C 490 330 555 340 555 388", t: 0.45, hue: "green", label: { x: 510, y: 330, text: "Approve" } },
  { d: "M555 432 C 555 480 360 475 360 513", t: 0.55 },
  { d: "M360 557 V628", t: 0.65 },
  { d: "M360 672 V743", t: 0.75 },
  { d: "M360 787 V848", t: 0.85 },
];

const ICONS = {
  brief: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h4",
  board: "M4 5h7v6H4z M13 5h7v6h-7z M4 13h7v6H4z M13 13h7v6h-7z",
  pin: "M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  loop: "M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  sheet: "M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5",
  film: "M4 5h16v14H4z M8 5v14 M16 5v14 M4 9h4 M4 15h4 M16 9h4 M16 15h4",
  invoice: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** 0 to 1 over a short window after `t`, eased out so things land softly. */
const ease = (p: number, t: number, span = 0.07) => {
  const x = clamp((p - t) / span);
  return 1 - Math.pow(1 - x, 3);
};

export function JobPath({
  eyebrow = "How a job moves",
  title = "Every step picks up where the last one left off.",
  body = "The shot list builds the schedule, the crew list sends the call sheet, and the invoice lands in the budget. Nothing gets retyped between steps.",
  cta,
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  cta?: React.ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [scale, setScale] = useState(0.6);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Scroll position -> progress. One rAF per frame at most, and a passive
  // listener, so the scroll itself is never held up by this.
  useEffect(() => {
    if (reduced) {
      setP(1);
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight;
      // The path finishes a little before the pin releases, so the completed
      // drawing sits still for a moment instead of scrolling away mid-stroke.
      setP(run > 0 ? clamp(-r.top / (run * 0.85)) : 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Fit the fixed stage into the room its column has, by width AND height, so
  // the whole path is always visible inside the pinned viewport.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / STAGE_W, h / STAGE_H, 1.1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={reduced ? "relative" : "relative lg:h-[320vh]"}>
      <div className="lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)]">
        <div className="mx-auto grid h-full max-w-[1400px] items-center gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-8">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
            <h2 className="font-display text-5xl font-extrabold leading-[1.0] tracking-[-0.02em] text-text sm:text-6xl">
              {title}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">{body}</p>
            {cta ? <div className="mt-8">{cta}</div> : null}
            {/* A quiet read-out of where the reader is, so the drawing has a
                caption that moves with it. */}
            <p className="mt-8 hidden text-sm font-semibold text-text-faint lg:block" aria-hidden="true">
              {stageLabel(p)}
            </p>
          </div>

          <div
            ref={boxRef}
            className="relative h-[min(78vw,640px)] w-full lg:h-full"
            role="img"
            aria-label="A project's path: brief, storyboard, client review which either sends it back for changes or approves it, then schedule, call sheet, delivery and the invoice."
          >
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: STAGE_W,
                height: STAGE_H,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            >
              <svg width={STAGE_W} height={STAGE_H} className="absolute inset-0 overflow-visible" aria-hidden="true">
                {EDGES.map((e, i) => {
                  const k = ease(p, e.t, 0.08);
                  const stroke = e.hue ? `var(--h-${e.hue})` : "var(--border-strong)";
                  return (
                    <g key={i}>
                      <path
                        d={e.d}
                        pathLength={1}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeDasharray={e.dash ? "0.02 0.018" : "1 1"}
                        strokeDashoffset={e.dash ? 0 : 1 - k}
                        style={e.dash ? { opacity: k } : undefined}
                      />
                      {e.label ? (
                        <text
                          x={e.label.x}
                          y={e.label.y}
                          textAnchor="middle"
                          className="font-body"
                          style={{ fontSize: 13, fontWeight: 700, fill: stroke, opacity: ease(p, e.t + 0.04, 0.05) }}
                        >
                          {e.label.text}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {NODES.map((n) => {
                const k = ease(p, n.t, 0.06);
                const c = n.chip ? ease(p, n.chip.t, 0.04) : 0;
                return (
                  <div
                    key={n.id}
                    className="absolute flex items-center gap-3 rounded-[14px] border border-border bg-surface px-3 py-2.5 shadow-[0_14px_34px_-18px_rgba(40,30,90,.45)]"
                    style={{
                      left: n.x - n.w / 2,
                      top: n.y - 22,
                      width: n.w,
                      height: 44 + 0,
                      opacity: k,
                      transform: `translateY(${(1 - k) * 14}px) scale(${0.92 + 0.08 * k})`,
                    }}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
                      style={{ background: `var(--h-${n.hue}-bg)`, color: `var(--h-${n.hue})` }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d={ICONS[n.icon]} />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[14px] font-bold text-text">{n.label}</span>
                      <span className="block truncate text-[11.5px] text-text-faint">{n.sub}</span>
                    </span>
                    {n.chip ? (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                        style={{
                          color: `var(--h-${n.chip.hue})`,
                          background: `var(--h-${n.chip.hue}-bg)`,
                          opacity: c,
                          transform: `scale(${0.6 + 0.4 * c})`,
                        }}
                      >
                        {n.chip.text}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function stageLabel(p: number) {
  if (p < 0.12) return "Scroll to follow the job";
  if (p < 0.23) return "The board goes out";
  if (p < 0.45) return "The client asks for changes";
  if (p < 0.6) return "Round two is approved";
  if (p < 0.8) return "The shoot is scheduled and called";
  if (p < 0.95) return "Delivered";
  return "Invoiced.";
}
