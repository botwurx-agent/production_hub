"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markMealOrdered, recordMealOpen } from "@/app/c/[token]/actions";
import { cutoffLabel, mealLabel } from "@/lib/meals";
import type { PublicMeal } from "@/lib/callsheet-links";

/**
 * The crew member's half of a meal round: the instructions, the deadline, and
 * the button through to whichever platform the producer is using.
 *
 * The click-through is recorded as the ordering link opens, in a new tab. That
 * ordering is on purpose: the person gets to the menu immediately and the
 * record is a side effect, rather than the food waiting on our round trip.
 */
export function MealCard({ token, meal }: { token: string; meal: PublicMeal }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(Boolean(meal.openedAt));
  const [busy, start] = useTransition();

  const cutoff = cutoffLabel(meal.cutoffAt);
  const closed = meal.cutoffAt
    ? Date.parse(meal.cutoffAt) < Date.now()
    : false;
  const label = mealLabel(meal.meal);

  function openOrder() {
    setOpened(true);
    void recordMealOpen(token, meal.roundId);
  }

  function confirmOrdered() {
    setError(null);
    start(async () => {
      const res = await markMealOrdered(token, meal.roundId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (meal.orderedAt) {
    return (
      <div
        className="flex items-center gap-2 rounded-[12px] border px-4 py-3 text-sm font-bold"
        style={{
          borderColor: "var(--green)",
          backgroundColor: "var(--green-bg)",
          color: "var(--green)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Your {label.toLowerCase()} order is in.
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-text">
          {label} order
        </h2>
        {cutoff ? (
          <span
            className="rounded-pill px-2.5 py-1 text-xs font-bold"
            style={
              closed
                ? { backgroundColor: "var(--red-bg)", color: "var(--red)" }
                : { backgroundColor: "var(--amber-bg)", color: "var(--amber)" }
            }
          >
            {closed ? `Closed at ${cutoff}` : `Order by ${cutoff}`}
          </span>
        ) : null}
      </div>

      {meal.budgetPerHead ? (
        <p className="mt-2 text-sm text-text-muted">
          Budget: ${meal.budgetPerHead.toFixed(2)} per person.
        </p>
      ) : null}
      {meal.instructions ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
          {meal.instructions}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={meal.orderUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openOrder}
          className="rounded-[11px] bg-accent px-5 py-2 text-sm font-bold text-accent-fg shadow-sm transition hover:bg-accent-strong"
        >
          Place your {label.toLowerCase()} order
        </a>
        {/* Only offered once they have been sent to the menu. Before that it
            would be a way to mark yourself done without ordering anything. */}
        {opened ? (
          <button
            onClick={confirmOrdered}
            disabled={busy}
            className="rounded-[11px] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? "Saving..." : "I've ordered"}
          </button>
        ) : null}
        {error ? (
          <span className="text-xs font-medium text-red">{error}</span>
        ) : null}
      </div>

      {closed ? (
        <p className="mt-3 text-xs text-text-faint">
          Ordering has closed. Speak to production if you still need something.
        </p>
      ) : null}
    </div>
  );
}
