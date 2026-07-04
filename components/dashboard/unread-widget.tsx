"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Live "new messages" count, mirroring the sidebar badge (polls the same route).
export function UnreadWidget() {
  const [count, setCount] = useState<number | null>(null);

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
        // leave last known value
      }
    };
    load();
    const id = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("focus", load);
    };
  }, []);

  return (
    <Link
      href="/communication"
      className="flex items-center justify-between rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2/70"
    >
      <span className="text-sm text-text-muted">New messages</span>
      <span className="font-display text-lg font-extrabold text-text">
        {count ?? "—"}
      </span>
    </Link>
  );
}
