import { Section } from "@/components/marketing/section";
import { LiveScene } from "@/components/marketing/scene-stage";
import type { Chapter } from "@/lib/marketing/chapters";

/**
 * A feature page told in CHAPTERS: each part of the feature gets a numbered
 * section with a headline, a paragraph, a detail list naming every capability
 * in it, and its own animated mini explainer (see lib/marketing/chapters.ts).
 *
 * Two columns per section, words and details on one side and the scene on its
 * colour canvas on the other, alternating sides so a run of five has a rhythm
 * rather than reading as one long left-aligned document. The scene is sticky
 * on wide screens: the detail list is the longer column, and the explainer
 * should stay in view while someone reads down it.
 */

export const chapterId = (i: number) => `part-${i + 1}`;

/** The row under the hero that says what the page covers, and jumps to it. */
export function ChapterIndex({ chapters, hue }: { chapters: Chapter[]; hue: string }) {
  return (
    <nav aria-label="On this page" className="mt-14 border-t border-border pt-8">
      <ol className="flex flex-wrap gap-2.5">
        {chapters.map((c, i) => (
          <li key={c.nav}>
            <a
              href={`#${chapterId(i)}`}
              className="flex items-center gap-2.5 rounded-full border border-border bg-surface py-2 pl-2 pr-4 text-[15px] font-semibold text-text shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full font-display text-[12px] font-extrabold"
                style={{ background: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
              >
                {i + 1}
              </span>
              {c.nav}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ChapterSections({ chapters, hue }: { chapters: Chapter[]; hue: string }) {
  return (
    <>
      {chapters.map((c, i) => {
        const flip = i % 2 === 1;
        return (
          <Section key={c.nav} id={chapterId(i)} tint={i % 2 === 0 ? "plain" : "tinted"} className="scroll-mt-16 !py-20 sm:!py-28">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
              <div className={flip ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3">
                  <span
                    className="font-display text-5xl font-extrabold leading-none tracking-tight"
                    style={{ color: `color-mix(in oklch, var(--h-${hue}) 40%, transparent)` }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: `var(--h-${hue})` }}>
                    {c.nav}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-[2.9rem]">
                  {c.title}
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-text-muted">{c.body}</p>
                {/* Every capability in this part, named. A bordered list with
                    hairlines, per 4.6: density over floating bullets. */}
                <ul className="mt-8 overflow-clip rounded-[20px] border border-border bg-surface shadow-sm">
                  {c.details.map((d) => (
                    <li key={d.t} className="flex gap-3.5 border-border px-5 py-4 [&:not(:first-child)]:border-t">
                      <span
                        className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full"
                        style={{ background: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
                      >
                        <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <h3 className="font-display text-[16.5px] font-bold tracking-tight text-text">{d.t}</h3>
                        <p className="mt-0.5 text-[15px] leading-relaxed text-text-muted">{d.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`lg:sticky lg:top-24 ${flip ? "lg:order-1" : ""}`}>
                <div
                  className="rounded-[28px] p-4 sm:p-7"
                  style={{
                    background: `linear-gradient(150deg, var(--h-${hue}-bg), color-mix(in oklch, var(--h-${hue}-bg) 45%, var(--surface)))`,
                  }}
                >
                  <LiveScene name={c.scene} />
                </div>
              </div>
            </div>
          </Section>
        );
      })}
    </>
  );
}
