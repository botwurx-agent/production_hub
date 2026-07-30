"use client";

import { useEffect } from "react";
import { startTour } from "@/components/tour/tour-open";
import { tourSeenKey } from "@/lib/tour/tours";

/**
 * Starts a tour on the first visit to the page that mounts it, and never again.
 * Renders nothing: the overlay itself is the single TourGuide in the app shell.
 *
 * Two deliberate details. The start is deferred a beat, because the anchors
 * have to exist before TourGuide resolves them, and a tour that starts against
 * an unpainted page finds nothing and quietly declines to run. And "seen" is
 * written when the tour ENDS rather than when it starts, so closing the tab
 * mid-tour does not count as having taken it.
 *
 * State lives in localStorage rather than the database. It is a per-person hint,
 * the same call the setup checklist made, and it is not worth a migration. The
 * known cost: signing in on a second machine offers the tour again once.
 */
export function TourTrigger({ tour, delay = 700 }: { tour: string; delay?: number }) {
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(tourSeenKey(tour)) === "1";
    } catch {
      // No localStorage means no way to remember it was dismissed, and a tour
      // that reappears on every page load is worse than one that never runs.
      return;
    }
    if (seen) return;

    const t = setTimeout(() => startTour(tour), delay);
    return () => clearTimeout(t);
  }, [tour, delay]);

  return null;
}
