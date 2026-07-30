"use client";

// A tiny module-level pub/sub so anything can open the Runner panel without a
// provider being threaded through the shell. Same shape as components/ui/toast,
// and used for the same reason: the trigger (a nav row in the sidebar, a button
// in the mobile topbar) and the panel itself live in different subtrees, and a
// context would mean wrapping the whole app to carry one boolean.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Opens the Runner panel from anywhere. */
export function openAgent() {
  listeners.forEach((fn) => fn());
}

export function onOpenAgent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
