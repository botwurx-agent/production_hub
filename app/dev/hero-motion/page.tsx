// A PREVIEW of the animated home hero, not the home page. The operator's
// reference is monday.com's hero (words left, an animated board right); this
// page shows our version in that layout so it can be judged before anything on
// the live site changes. ?clean=1 hides the note bar for recording, and
// ?theme=dark previews the dark theme. Auth-gated in production by /dev/*.
import { HeroMotion } from "@/components/marketing/hero-motion";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { clean?: string; theme?: string } }) {
  return (
    <div data-theme={searchParams.theme === "dark" ? "dark" : "light"} className="min-h-screen bg-bg text-text">
      {searchParams.clean === "1" ? null : (
        <div className="border-b border-border bg-surface px-6 py-2 text-xs font-semibold text-text-muted">
          Preview only. Not on the live site.
        </div>
      )}
      <section
        className="mx-auto grid max-w-[1320px] items-center gap-14 px-6 py-16 sm:px-10 lg:min-h-[760px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:py-10"
      >
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            For production studios of every scale
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-[4.25rem]">
            Every job, in <span className="text-accent">one place</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
            From the first brief to the final invoice. Client approvals that do not get lost,
            call sheets that confirm themselves, and a budget that tells you what the job
            actually made.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CtaButton shine />
            <CtaButton variant="quiet" href="/#review" label="See it work" />
          </div>
          <CtaMicrocopy className="mt-4" />
        </div>
        <div
          className="relative rounded-[32px] p-6 sm:p-12"
          style={{ background: "linear-gradient(145deg, var(--h-indigo-bg) 0%, var(--surface-2) 60%, var(--surface) 100%)" }}
        >
          <HeroMotion />
        </div>
      </section>
    </div>
  );
}
