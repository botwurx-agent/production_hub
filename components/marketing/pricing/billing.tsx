"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Monthly against annual, held ONCE for the whole page.
 *
 * The toggle sits above the cards and the comparison table's sticky header
 * shows prices too, and those two are half a page apart. Local state in either
 * one would let the page state two different prices for the same plan at the
 * same moment, which is the sort of thing a buyer notices and never mentions.
 *
 * Provider takes children so the page can keep composing its sections on the
 * server: only the pieces that read the value become client components.
 */
const BillingContext = createContext<{
  annual: boolean;
  setAnnual: (v: boolean) => void;
} | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  // ANNUAL IS THE DEFAULT POSITION and monthly is the click. It is the cheaper
  // number, so it is the one that should be on screen when somebody is deciding
  // whether this is affordable at all.
  const [annual, setAnnual] = useState(true);
  return (
    <BillingContext.Provider value={{ annual, setAnnual }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used inside a BillingProvider");
  return ctx;
}

export function BillingToggle({ className = "" }: { className?: string }) {
  const { annual, setAnnual } = useBilling();
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1 shadow-sm"
      >
        {[
          { value: false, label: "Monthly" },
          { value: true, label: "Annual" },
        ].map((opt) => {
          const on = annual === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAnnual(opt.value)}
              className={`rounded-pill px-5 py-2 text-[14px] font-semibold transition ${
                on
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {/* Two months free, not a percentage. A count of months is a thing you
          can picture; 16.7% is a sum you have to do. The height is reserved
          either way so switching the toggle does not shift the cards. */}
      <p className="h-5 text-sm font-medium text-text-faint">
        {annual ? "Two months free, billed once a year" : " "}
      </p>
    </div>
  );
}
