"use client";

// A tiny module-level pub/sub so anything can open the invite panel, the same
// shape as components/agent/agent-open and components/ui/toast, and for the
// same reason: the panel is mounted once in the topbar and the things that want
// to open it (a task's people picker today, anything else tomorrow) live in a
// different subtree.
//
// WHY THIS EXISTS AT ALL: the topbar's invite button is on every page, but
// "there is nobody else to assign this to" is realised inside a task, and
// nobody hunting for a way to add a colleague looks in the utility tray at the
// top right. The affordance has to be where the need appears.
//
// Anything calling openInvite() must first check that inviting is possible:
// the panel is not mounted for collaborators (their invite actions refuse them
// anyway), so a caller that does not check would be a button that does nothing.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Opens the invite panel from anywhere. No-op if nothing is mounted. */
export function openInvite() {
  listeners.forEach((fn) => fn());
}

export function onOpenInvite(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
