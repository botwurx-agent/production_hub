"use client";

// Module-level pub/sub so anything can start a tour, matching the pattern used
// by the toast and by Runner. The replay entry in the user menu and the
// auto-start on first visit both drive the same runner.

type Listener = (tourId: string) => void;

const listeners = new Set<Listener>();

export function startTour(tourId: string) {
  listeners.forEach((fn) => fn(tourId));
}

export function onStartTour(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
