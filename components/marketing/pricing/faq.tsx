import { FAQS } from "@/lib/marketing/pricing";

/**
 * <details> rather than React state, so this stays a server component, works
 * with JavaScript off, and gets keyboard and screen-reader behaviour for free.
 *
 * Two INDEPENDENT columns rather than a two-column grid of items: in a grid,
 * opening one answer stretches the row and shoves its neighbour down, which
 * makes the page jump under someone who is reading the other one.
 */
function Item({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border py-5">
      <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-display text-[16.5px] font-bold leading-snug tracking-tight text-text">
          {q}
        </span>
        <span
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-text-muted transition group-open:bg-accent group-open:text-accent-fg"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path
              d="M7 2.5v9M2.5 7h9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="origin-center transition-transform group-open:rotate-45"
            />
          </svg>
        </span>
      </summary>
      <p className="mt-3 max-w-prose pr-10 text-[15px] leading-relaxed text-text-muted">
        {a}
      </p>
    </details>
  );
}

export function PricingFaq() {
  const half = Math.ceil(FAQS.length / 2);
  const columns = [FAQS.slice(0, half), FAQS.slice(half)];
  return (
    <div className="mx-auto grid max-w-5xl gap-x-14 md:grid-cols-2">
      {columns.map((col, i) => (
        <div key={i}>
          {col.map((f) => (
            <Item key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      ))}
    </div>
  );
}
