"use client";

import { SIGNUP_URL } from "@/lib/marketing/hosts";
import { PLANS, SEAT_NOTE, planPrice, type Plan } from "@/lib/marketing/pricing";
import { useBilling } from "./billing";

function Tick() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      className="mt-[3px] shrink-0 text-accent"
      aria-hidden="true"
    >
      <path
        d="M4 10.5 8 14l8-8"
        stroke="currentColor"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price = planPrice(plan, annual);
  const featured = plan.featured === true;
  const isFree = price === 0;

  return (
    <div
      className={
        featured
          ? // Raised, ringed and badged. The badge is the highest-leverage
            // element on a pricing page: most people do not want to choose, and
            // it chooses for them. Exactly one card may carry it.
            "relative flex flex-col rounded-[22px] border-2 border-accent bg-surface p-6 shadow-xl lg:-my-4 lg:p-7"
          : "relative flex flex-col rounded-[22px] border border-border bg-surface p-6 shadow-md"
      }
    >
      {featured ? (
        <span
          className="absolute -top-3 left-7 rounded-pill px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {/* NOT "Most popular", which is the category default and which we
              have no right to say: there are no customers yet, so it would be
              invented social proof on the most scrutinised page of the site.
              "Best value" is a claim we can actually defend, since this tier
              is the cheapest per seat at its included allowance. */}
          Best value
        </span>
      ) : null}

      <h3 className="font-display text-2xl font-extrabold tracking-tight text-text">
        {plan.name}
      </h3>
      <p className="mt-1.5 text-[14px] leading-snug text-text-muted">
        {plan.tagline}
      </p>

      <div className="mt-6 flex items-end gap-1.5">
        <span className="font-display text-[52px] font-extrabold leading-[0.9] tracking-tight text-text">
          ${price}
        </span>
        {!isFree && (
          <span className="pb-1 text-[15px] font-medium text-text-muted">
            /month
          </span>
        )}
      </div>
      {/* The yearly total spelled out, because "per month billed annually" is
          the one line on a pricing page people suspect of hiding something. */}
      <p className="mt-2 text-[13px] text-text-faint">
        {isFree
          ? "Free forever, not a trial"
          : annual
            ? `Billed annually, $${(price * 12).toLocaleString()} a year`
            : "Billed monthly"}
      </p>

      <a
        href={SIGNUP_URL}
        className={`mt-7 inline-flex items-center justify-center rounded-pill px-6 py-3 text-[15px] font-semibold transition ${
          featured
            ? "bg-accent text-accent-fg shadow-md hover:bg-accent-strong"
            : "border border-border-strong bg-surface text-text hover:bg-surface-2"
        }`}
      >
        {isFree ? "Start free" : `Start with ${plan.name}`}
      </a>
      <p className="mt-2.5 text-center text-[12.5px] text-text-faint">
        {isFree
          ? "No card, and no expiry."
          : "Begin on Free and move up when you outgrow it."}
      </p>

      {plan.builds ? (
        <p className="mt-7 text-[13px] font-bold uppercase tracking-[0.1em] text-text-muted">
          Everything in {plan.builds}, plus
        </p>
      ) : (
        <p className="mt-7 text-[13px] font-bold uppercase tracking-[0.1em] text-text-muted">
          What you get
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {plan.points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[14.5px] leading-snug text-text">
            <Tick />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanCards() {
  const { annual } = useBilling();
  return (
    <div>
      {/* items-start, so the featured card's negative margin lifts it rather
          than stretching its neighbours to match. */}
      <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} annual={annual} />
        ))}
      </div>
      {/* The single highest-value line on the page. StudioBinder answers this
          same question first in their FAQ, which means it is the thing every
          buyer in this category wants to know and half of them never click to
          find out. It goes in plain sight instead. */}
      <p className="mx-auto mt-9 max-w-2xl text-center text-[15px] leading-relaxed text-text-muted">
        {SEAT_NOTE}
      </p>
    </div>
  );
}
