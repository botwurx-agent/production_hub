"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SetupStep } from "@/lib/setup-steps";

const DISMISS_KEY = "dashboard.setupDismissed";

// First-run guidance on the dashboard. It goes away on its own once the studio
// has done all five things, so it costs an established user nothing; the manual
// dismiss is for someone who wants it gone before then.
//
// Dismissal lives in localStorage rather than the database on purpose: it is a
// per-person view preference about a hint, not studio state, and it is not
// worth a migration or a write on every dashboard load.
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [dismissed, setDismissed] = useState(false);
  // Start hidden and reveal after reading localStorage, so a user who dismissed
  // it never sees it flash back on every navigation.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
    setReady(true);
  }, []);

  const remaining = steps.filter((s) => !s.done);
  if (!ready || dismissed || remaining.length === 0) return null;

  const doneCount = steps.length - remaining.length;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <section
      data-tour="setup"
      className="mb-6 rounded-[16px] border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-text">
            Get your studio set up
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {doneCount} of {steps.length} done. This disappears once you finish.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-xs font-semibold text-text-faint transition hover:text-text"
        >
          Hide
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.id}
            // A quiet per-step accent on the left edge: wayfinding only, kept
            // well below the weight of a status chip so the two never compete.
            style={{ borderLeftColor: `var(--h-${s.hue})` }}
            className={`flex items-start gap-3 rounded-[12px] border border-border border-l-[3px] px-3 py-2.5 transition ${
              s.done ? "opacity-55" : "hover:border-border-strong"
            }`}
          >
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
              style={
                s.done
                  ? {
                      backgroundColor: `var(--h-${s.hue}-bg)`,
                      color: `var(--h-${s.hue})`,
                    }
                  : { border: "1.5px solid var(--border-strong)" }
              }
              aria-hidden
            >
              {s.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold text-text ${
                  s.done ? "line-through decoration-1" : ""
                }`}
              >
                {s.title}
              </p>
              {!s.done && (
                <>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {s.text}
                  </p>
                  <Link
                    href={s.href}
                    className="mt-1.5 inline-block text-xs font-semibold text-accent hover:underline"
                  >
                    {s.cta} &rarr;
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
