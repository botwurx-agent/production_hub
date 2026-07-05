"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/app-shell/nav-icons";
import { timeAgo } from "@/lib/format";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(app)/notification-actions";
import type { Notification } from "@/lib/database.types";

const TYPE_HUE: Record<string, string> = {
  client_comment: "blue",
  client_approved: "green",
  client_changes: "red",
};

export function NotificationBell({ needsYouCount = 0 }: { needsYouCount?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await getNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function openItem(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationRead(n.id);
    }
    if (n.href) router.push(n.href);
  }

  function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    void markAllNotificationsRead();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-border bg-surface text-text-muted shadow-sm transition hover:border-border-strong hover:text-text"
      >
        <BellIcon />
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--h-red)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-[14px] border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-bold text-text">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {needsYouCount > 0 && (
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5 text-sm transition hover:bg-surface-2"
            >
              <span className="font-semibold text-text">
                {needsYouCount} item{needsYouCount === 1 ? "" : "s"} need your sign-off
              </span>
              <span className="text-xs font-semibold text-accent">View</span>
            </Link>
          )}

          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-faint">
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="flex w-full items-start gap-2.5 border-b border-border px-4 py-2.5 text-left transition last:border-0 hover:bg-surface-2/60"
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: n.read_at
                        ? "var(--border-strong)"
                        : `var(--h-${TYPE_HUE[n.type] ?? "indigo"})`,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read_at ? "text-text-muted" : "font-semibold text-text"}`}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-xs text-text-faint">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-text-faint">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
