"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { switchStudio } from "@/app/(app)/studio-actions";
import { FeedbackModal } from "@/components/feedback/feedback-modal";
import type { StudioOption } from "@/components/app-shell/studio-switcher";

export function UserMenu({
  email,
  studios = [],
  activeStudioId = "",
}: {
  email: string | null;
  studios?: StudioOption[];
  activeStudioId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.[0] ?? "?").toUpperCase();
  // The sidebar switcher is hidden below md, so on a phone this menu is the
  // only way to change studio.
  const multiple = studios.length > 1;

  function choose(id: string) {
    if (id === activeStudioId) {
      setOpen(false);
      return;
    }
    start(async () => {
      const res = await switchStudio(id);
      if (res?.error) return;
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

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
          {multiple && (
            <div className="border-b border-border py-1 md:hidden">
              <div className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                Studio
              </div>
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose(s.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.id === activeStudioId && (
                    <span className="shrink-0 text-accent" aria-label="Current">
                      &#10003;
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              setOpen(false);
              setFeedbackOpen(true);
            }}
            className="w-full px-4 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            Send feedback
          </button>
          <form action={signOut} className="border-t border-border">
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-red"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
