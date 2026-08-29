"use client";

import { useState } from "react";
import { SIGNUP_URL } from "@/lib/marketing/hosts";
import {
  COMPARE,
  PLANS,
  planPrice,
  type Cell,
  type CompareBand,
} from "@/lib/marketing/pricing";
import { useBilling } from "./billing";

/**
 * The feature comparison.
 *
 * Two things here are taken deliberately from how the category already does
 * this, and one is deliberately refused.
 *
 * TAKEN: the plan header PINS while you scroll the rows, so somebody convinced
 * at row forty does not have to scroll back to the top to act on it. And each
 * band carries a one-line pitch, which turns a wall of ticks into a second
 * features page for a reader who came to pricing before they read anything.
 *
 * REFUSED: rows named "Advanced <thing>". A buyer cannot evaluate one, so it
 * does no work except imply the cheaper plan is broken, and each one is a
 * promise to maintain two versions of that feature forever. Where a tier
 * genuinely differs, the row names the actual capability.
 *
 * The grid is divs rather than a <table> because a sticky header, collapsible
 * groups and a tinted middle column are all fighting border-collapse otherwise.
 * Every cell carries an sr-only word, so the meaning does not live in an icon.
 */

/** Column widths, kept in one place so a header cell cannot drift from a row. */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_54px_54px_54px_54px] sm:grid-cols-[minmax(0,1fr)_repeat(4,92px)] lg:grid-cols-[minmax(0,1fr)_repeat(4,150px)]";

/** The featured plan's column is tinted top to bottom, like its card. */
function colTint(i: number) {
  return PLANS[i]?.featured ? "bg-accent-soft" : "";
}

function CellView({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <span className="sr-only">Included</span>
        <svg width="19" height="19" viewBox="0 0 20 20" className="text-accent" aria-hidden="true">
          <path
            d="M4 10.5 8 14l8-8"
            stroke="currentColor"
            strokeWidth="2.1"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <span className="sr-only">Not included</span>
        {/* A short rule rather than an empty cell, so a blank reads as a
            decision instead of an omission. */}
        <span className="block h-px w-3 bg-border-strong" aria-hidden="true" />
      </>
    );
  }
  // A value column is 60px on a phone, so anything longer than "Unlimited" has
  // to be allowed to wrap rather than run into its neighbour.
  return (
    <span className="break-words text-[10px] font-semibold leading-tight text-text sm:text-[13px]">
      {value}
    </span>
  );
}

function Band({ band }: { band: CompareBand }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition hover:bg-surface-2 sm:px-6"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]"
          style={{
            backgroundColor: `var(--h-${band.hue}-bg)`,
            color: `var(--h-${band.hue})`,
          }}
        >
          <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d={band.icon}
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-extrabold tracking-tight text-text">
            {band.name}
          </span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-text-muted">
            {band.blurb}
          </span>
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          className={`shrink-0 text-text-faint transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden="true"
        >
          <path
            d="M5 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div>
          {band.rows.map((row) => (
            <div key={row.label} className={`${GRID} border-t border-border`}>
              <div className="px-3 py-3.5 text-[13px] leading-snug text-text sm:px-6 sm:text-[14.5px]">
                {row.label}
              </div>
              {row.cells.map((cell, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center px-1 py-3.5 text-center ${colTint(i)}`}
                >
                  <CellView value={cell} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CompareTable() {
  const { annual } = useBilling();
  return (
    <div>
      {/* Sticks at top-0 with 68px of its own top padding, NOT at top-16.
          The site nav is transparent by design, so anything sticking below it
          leaves a strip where rows scroll past behind the blur, which reads as
          a smear beside the wordmark. Padding inside the sticky box paints the
          ground behind the nav instead; the matching negative margin puts the
          resting position back exactly where it was, so this costs no layout.
          z stays under the nav's 40 so the bar slides beneath it. */}
      <div className="sticky top-0 z-30 -mt-[68px] bg-bg pt-[68px]">
        <div className={`${GRID} border-b border-border`}>
          <div className="hidden items-end pb-4 pr-6 sm:flex">
            <p className="font-display text-[22px] font-extrabold tracking-tight text-text">
              Compare every plan
            </p>
          </div>
          <div className="sm:hidden" />
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`flex flex-col items-center gap-1 px-1 pb-3 pt-3 ${colTint(i)}`}
            >
              <p className="font-display text-[11px] font-extrabold leading-tight tracking-tight text-text sm:text-[15px]">
                {plan.name}
              </p>
              <p className="text-[10.5px] font-semibold text-text-muted sm:text-[13px]">
                {planPrice(plan, annual) === 0 ? (
                  // "$0" rather than the word, which under a column already
                  // headed "Free" would just say it twice.
                  "$0"
                ) : (
                  <>
                    ${planPrice(plan, annual)}
                    <span className="font-normal text-text-faint">/mo</span>
                  </>
                )}
              </p>
              {/* The button is the reason to pin this row at all, so it only
                  disappears where there is genuinely no width for it. */}
              <a
                href={SIGNUP_URL}
                className={`mt-0.5 hidden rounded-pill px-3 py-1.5 text-[12.5px] font-semibold transition sm:inline-flex ${
                  plan.featured
                    ? "bg-accent text-accent-fg hover:bg-accent-strong"
                    : "border border-border-strong bg-surface text-text hover:bg-surface-2"
                }`}
              >
                Start free
              </a>
            </div>
          ))}
        </div>
      </div>

      {COMPARE.map((band) => (
        <Band key={band.name} band={band} />
      ))}
    </div>
  );
}
