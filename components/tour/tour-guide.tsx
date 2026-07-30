"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findTour, tourSeenKey, type TourStep } from "@/lib/tour/tours";
import { onStartTour } from "@/components/tour/tour-open";

const CARD_W = 320;
const GAP = 12;

type Placed = {
  card: { top: number; left: number };
  spot: { top: number; left: number; width: number; height: number } | null;
};

function anchorEl(step: TourStep): HTMLElement | null {
  if (!step.anchor) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
}

/**
 * Renders whichever tour has been started. Mounted ONCE in the app shell, so
 * the replay entry in the user menu works from any page; a per-page mount
 * would mean the menu item silently did nothing everywhere it was not.
 * First-run auto-start is TourTrigger's job, not this component's.
 *
 * Runs a tour: a dimmed page, a ring around the thing being talked about, and a
 * card beside it.
 *
 * Two rules do most of the work of keeping this from rotting:
 *
 *  - A step whose anchor is missing is dropped, not shown. Anchors are
 *    data-tour attributes rather than CSS selectors, so restyling cannot break
 *    them, and deleting an element costs one step instead of leaving a card
 *    pointing at empty space. It also means the sidebar steps disappear by
 *    themselves on a phone, where there is no sidebar.
 *  - The whole tour is skipped if nothing it describes is on the page.
 */
export function TourGuide() {
  const [tourId, setTourId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const begin = useCallback((id: string) => {
    const tour = findTour(id);
    if (!tour) return;
    // Resolve anchors at start time, so a tour only ever contains steps that
    // actually have something to point at right now.
    const live = tour.steps.filter((s) => !s.anchor || anchorEl(s));
    // A tour made only of its own opening and closing cards has nothing to
    // say. Better to show nothing than to narrate an empty page.
    if (!live.some((s) => s.anchor)) return;
    setSteps(live);
    setIndex(0);
    setTourId(id);
  }, []);

  useEffect(() => onStartTour(begin), [begin]);

  const step = tourId ? steps[index] : undefined;

  const place = useCallback(() => {
    if (!step) return;
    const el = anchorEl(step);
    if (!el) {
      setPlaced({
        card: {
          top: Math.max(16, window.innerHeight / 2 - 110),
          left: Math.max(16, window.innerWidth / 2 - CARD_W / 2),
        },
        spot: null,
      });
      return;
    }

    const r = el.getBoundingClientRect();
    const h = cardRef.current?.offsetHeight ?? 190;
    const prefer = step.place ?? "bottom";

    const room = {
      top: r.top,
      bottom: window.innerHeight - r.bottom,
      left: r.left,
      right: window.innerWidth - r.right,
    };
    // Try the preferred side, then whichever has the most space. A card that
    // runs off screen is worse than one on the "wrong" side.
    const order = [prefer, "bottom", "right", "top", "left"] as const;
    const fits = (side: string) =>
      side === "top" || side === "bottom"
        ? room[side as "top" | "bottom"] >= h + GAP
        : room[side as "left" | "right"] >= CARD_W + GAP;
    const side = order.find(fits) ?? prefer;

    let top: number;
    let left: number;
    if (side === "top") {
      top = r.top - h - GAP;
      left = r.left;
    } else if (side === "bottom") {
      top = r.bottom + GAP;
      left = r.left;
    } else if (side === "left") {
      top = r.top;
      left = r.left - CARD_W - GAP;
    } else {
      top = r.top;
      left = r.right + GAP;
    }

    setPlaced({
      card: {
        top: Math.max(16, Math.min(top, window.innerHeight - h - 16)),
        left: Math.max(16, Math.min(left, window.innerWidth - CARD_W - 16)),
      },
      spot: {
        top: r.top - 6,
        left: r.left - 6,
        width: r.width + 12,
        height: r.height + 12,
      },
    });
  }, [step]);

  // Bring the target into view first, then measure. Measuring before the
  // scroll settles puts the card where the element used to be.
  useLayoutEffect(() => {
    if (!step) return;
    const el = anchorEl(step);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(place, el ? 320 : 0);
    return () => clearTimeout(t);
  }, [step, place]);

  useEffect(() => {
    if (!tourId) return;
    const on = () => place();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [tourId, place]);

  const end = useCallback(() => {
    if (tourId) {
      try {
        localStorage.setItem(tourSeenKey(tourId), "1");
      } catch {}
    }
    setTourId(null);
    setPlaced(null);
  }, [tourId]);

  useEffect(() => {
    if (!tourId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") end();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tourId, steps.length, end]);

  if (!mounted || !tourId || !step) return null;

  const last = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-label="Guided tour">
      {/* One element makes the whole scrim: a huge spread shadow dims
          everything except the ring itself. */}
      {placed?.spot ? (
        <div
          className="pointer-events-none absolute rounded-[12px] transition-all duration-200"
          style={{
            top: placed.spot.top,
            left: placed.spot.left,
            width: placed.spot.width,
            height: placed.spot.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
            outline: "2px solid var(--accent)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {/* Click-off, behind the card. */}
      <button
        type="button"
        aria-label="End the tour"
        onClick={end}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        ref={cardRef}
        className="absolute rounded-[14px] border border-border bg-surface p-4 shadow-lg"
        style={{
          width: CARD_W,
          top: placed?.card.top ?? -9999,
          left: placed?.card.left ?? -9999,
        }}
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          {index + 1} of {steps.length}
        </p>
        <h3 className="font-display text-base font-bold text-text">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={end}
            className="text-xs font-medium text-text-faint hover:text-text-muted"
          >
            Skip
          </button>
          <div className="flex-1" />
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="rounded-[8px] px-2.5 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? end() : setIndex((i) => i + 1))}
            className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
