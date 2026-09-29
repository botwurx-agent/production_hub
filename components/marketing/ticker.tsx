/**
 * The running line near the foot of the home page, from monday.com's (the
 * operator asked for it, 2026-09-29, and it overrides the "skip the marquee"
 * call in docs/competitor-research/monday.md).
 *
 * Pure CSS: the list is rendered twice in one track and the track slides by
 * exactly half its width, so the loop has no seam. Hover pauses it, so a
 * phrase someone is reading does not slide away. Reduced motion gets a still,
 * wrapped list instead, since a line that never moves must not be cut off.
 *
 * No `>` in the inline style below: React escapes it in the server HTML and
 * the page fails to hydrate. Hence the tk-dup class.
 *
 * Every line has to be something the product does today: this is copy, not a
 * place for promises.
 */
export function Ticker({ items, hue = "indigo" }: { items: string[]; hue?: string }) {
  const run = (hidden: boolean) =>
    items.map((line, i) => (
      <span key={`${hidden}-${i}`} className={`flex shrink-0 items-center${hidden ? " tk-dup" : ""}`} aria-hidden={hidden || undefined}>
        <span className="whitespace-nowrap px-8 font-display text-4xl font-extrabold tracking-[-0.02em] text-text sm:text-6xl">
          {line}
        </span>
        <span className="h-3 w-3 shrink-0 rounded-full sm:h-4 sm:w-4" style={{ background: `var(--h-${["pink", "green", "amber", "indigo", "cyan"][i % 5]})` }} />
      </span>
    ));
  return (
    <section
      aria-label="What Studio Flows does"
      className="tk relative overflow-hidden border-y border-border py-8 sm:py-10"
      style={{ background: `linear-gradient(90deg, var(--h-${hue}-bg), var(--surface-2) 50%, var(--h-${hue}-bg))` }}
    >
      <div className="tk-track flex w-max">
        {run(false)}
        {run(true)}
      </div>
      <style>{`
        .tk-track { animation: tk-slide ${items.length * 7}s linear infinite }
        .tk:hover .tk-track { animation-play-state: paused }
        @keyframes tk-slide { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @media (prefers-reduced-motion: reduce) {
          .tk-track { animation: none; width: auto; flex-wrap: wrap; justify-content: center; row-gap: 1rem }
          .tk-dup { display: none }
        }
      `}</style>
    </section>
  );
}
