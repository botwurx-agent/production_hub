"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export function UserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.[0] ?? "?").toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent transition hover:ring-2 hover:ring-accent-soft"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-[13px] border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              Signed in as
            </div>
            <div className="truncate text-sm font-medium text-text">
              {email ?? "Unknown"}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-red"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
