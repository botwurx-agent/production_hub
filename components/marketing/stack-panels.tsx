import type { ReactNode } from "react";

/**
 * Sections that slide up over each other as you scroll, from monday.com's home
 * page (docs/competitor-research/monday.md): each panel pins below the nav and
 * the next one rides up and covers it, so a long run of features reads like a
 * deck being dealt rather than a scroll.
 *
 * PURE CSS, no script: `position: sticky` does the whole thing. Two rules make
 * it work, and both were the failure modes of a first sketch:
 * - A pinned panel is NEVER taller than the viewport under the nav. A sticky
 *   element taller than the room it pins into shows its top forever and its
 *   bottom never, so the panel has a fixed height and the evidence is SCALED
 *   to fit it (never cropped: see the note on the evidence column).
 * - Only from `lg`. On a phone the viewport is too short to hold a headline and
 *   a product shot at once, so the panels simply stack.
 *
 * Each panel is its own rounded canvas in the page's staging style (section
 * 4.6): the hue's pale -bg into surface, a hairline border and a shadow on the
 * top edge so the covering panel reads as lifted over the one beneath.
 */
export type StackPanel = {
  eyebrow: string;
  title: string;
  body: string;
  hue: string;
  cta?: ReactNode;
  /** The evidence, normally a LiveScene. Fills the right column. */
  children: ReactNode;
};

export function StackPanels({ panels }: { panels: StackPanel[] }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-10">
      {panels.map((p, i) => (
        <div
          key={p.title}
          className="mb-6 lg:sticky lg:top-[4.75rem] lg:mb-0 lg:h-[calc(100dvh-5.75rem)] lg:pb-6"
          // Later panels sit above earlier ones.
          style={{ zIndex: i + 1 }}
        >
          <article
            className="grid h-full overflow-hidden rounded-[32px] border border-border px-6 py-8 shadow-[0_-18px_50px_-30px_rgba(40,30,90,.35)] sm:px-12 sm:py-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:items-center lg:gap-12 lg:py-10"
            style={{
              background: `linear-gradient(160deg, var(--h-${p.hue}-bg) 0%, var(--surface-2) 45%, var(--surface) 100%)`,
            }}
          >
            <div>
              <p
                className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: `var(--h-${p.hue})` }}
              >
                {p.eyebrow}
              </p>
              <h2 className="font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.025em] text-text lg:text-[3.75rem]">
                {p.title}
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-text-muted">{p.body}</p>
              {p.cta ? <div className="mt-6">{p.cta}</div> : null}
            </div>
            {/* The evidence FITS the panel, whole. The first version let a
                screenshot bleed off the bottom edge the way monday's panels
                crop their UI, and the operator was right that it cut off the
                thing being shown. The scenes are fixed drawings scaled to
                this box (scene-kit.tsx FitStage), so nothing is ever lost. */}
            <div className="mt-8 min-h-0 lg:mt-0 lg:h-full">{p.children}</div>
          </article>
        </div>
      ))}
    </div>
  );
}
