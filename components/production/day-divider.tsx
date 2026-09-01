/**
 * The card that opens a shoot day inside a shot list export.
 *
 * A two-day shoot goes out as ONE document, so the reader needs to be told
 * where Thursday ends without counting tiles. This is that marker: a full dark
 * panel that takes the top of the page, states which day it is at a size
 * nobody can miss, and lists the shots on it as a small table of contents.
 *
 * DARK, and print-exact, for the same reason ProductionCover is: it is a
 * divider, and a divider that prints as a white rectangle with the ink saved
 * divides nothing. It shares the cover's vocabulary (mono eyebrow, display
 * headline, hairline chips) so the day cards read as part of the same document
 * rather than as a second design.
 *
 * NOTHING HERE IS INVENTED. There is no per-day description field and no
 * per-day date on a shot list, so the line under the headline states what can
 * actually be counted (how many shots, and which codes it runs between) rather
 * than prose nobody wrote. If a per-day note is ever wanted, it wants a column,
 * not a guess.
 */

const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

/**
 * The gradient hairline across the top. Built from the hue tokens rather than
 * from hex, so it follows the theme like everything else. Not decoration for
 * its own sake: it is the one mark that says "a new section starts here" while
 * the page is still being turned.
 */
const RULE =
  "linear-gradient(90deg, var(--h-yellow), var(--h-orange), var(--h-red), var(--h-pink), var(--h-purple), var(--h-indigo), var(--h-cyan), var(--h-green))";

export type DayShot = {
  /** The producer's own code for the shot ("1A", "4"). May be blank. */
  code: string | null;
  /** Position in the running order, used to name a shot with no code. */
  n: number;
};

export function DayDivider({
  label,
  shots,
  overline,
}: {
  /** "Day 2", or whatever the producer typed if it is not a number. */
  label: string;
  shots: DayShot[];
  /** Small line above the headline: the job, the location, whatever is known. */
  overline?: string | null;
}) {
  const names = shots.map((s) => s.code?.trim() || String(s.n).padStart(2, "0"));
  const span =
    names.length > 1 ? `${names[0]} through ${names[names.length - 1]}` : names[0];

  return (
    <div
      data-theme="dark"
      style={printExact}
      className="overflow-hidden rounded-[16px] bg-bg text-text print:rounded-none"
    >
      <div style={{ ...printExact, background: RULE }} className="h-[5px] w-full" />
      <div className="px-8 py-14">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange">
          {overline?.trim() || "Shoot schedule"}
        </div>
        <h2 className="mt-4 font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-text">
          {label}
        </h2>
        <p className="mt-4 max-w-lg text-base text-text-muted">
          {shots.length} {shots.length === 1 ? "shot" : "shots"}
          {span ? `, ${span}.` : "."}
        </p>
        {names.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2.5">
            {names.map((n, i) => (
              <span
                key={i}
                style={printExact}
                className="rounded-pill border border-border-strong px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted"
              >
                Shot {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
