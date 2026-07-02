"use client";

import { useEffect, useState } from "react";

// Dispatched (as a window Event) after a conversation is opened/marked read, so
// the badge refetches immediately instead of waiting for the poll interval.
export const COMMS_READ_EVENT = "communication:read";

// Small count of new incoming messages on the Communication nav item. Polls a
// lightweight API route on mount, on window focus, every 60s, and whenever a
// conversation is marked read. Hides itself at zero.
export function CommunicationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/communication/unread", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { total?: number };
        if (alive) setCount(data.total ?? 0);
      } catch {
        // Network hiccup: leave the last known count in place.
      }
    };

    load();
    const id = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    window.addEventListener(COMMS_READ_EVENT, load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", load);
      window.removeEventListener(COMMS_READ_EVENT, load);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-accent-fg"
      aria-label={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
