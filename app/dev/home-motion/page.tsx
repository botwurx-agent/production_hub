// A PREVIEW of the home page rebuilt around motion, from the monday.com review
// the operator agreed (docs/competitor-research/monday.md). Not the live home
// page: nothing on studio-flows.com changes until they place it. It renders in
// the real marketing shell (nav, footer, light theme) so it can be judged as
// the page, not as parts. Auth-gated in production by the /dev/* rule.
import "../../(marketing)/marketing.css";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Aurora } from "@/components/marketing/aurora";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { HeroMotion } from "@/components/marketing/hero-motion";
import { JobPath } from "@/components/marketing/job-path";
import { StackPanels } from "@/components/marketing/stack-panels";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { DemoVideo } from "@/components/marketing/demo-video";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div data-theme="light" data-accent="indigo" className="relative flex min-h-screen flex-col bg-bg font-body text-text">
      <Aurora />
      <SiteNav />
      <main className="relative z-10 flex-1">
        {/* HERO: words left, the animated board right, filling the fold. */}
        <section className="mx-auto grid max-w-[1400px] items-center gap-14 px-6 pb-20 pt-10 sm:px-10 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:pb-10">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              For production studios of every scale
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.0] tracking-[-0.025em] text-text sm:text-[4.5rem]">
              Every job, in <span className="text-accent">one place</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
              From the first brief to the final invoice. Client approvals that do not get lost,
              call sheets that confirm themselves, and a budget that tells you what the job
              actually made.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaButton shine />
              <CtaButton variant="quiet" href="#path" label="See the job" />
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

        {/* THE JOB'S PATH: drawn by the scroll. */}
        <div id="path">
          <JobPath cta={<CtaButton size="sm" />} />
        </div>

        {/* FEATURES: panels that slide up over each other. */}
        <StackPanels
          panels={[
            {
              eyebrow: "Client review",
              title: "Clients point at the frame.",
              body: "Send a link, no login on their end. Notes come back pinned to the exact spot on the frame, or the exact moment in the cut.",
              hue: "pink",
              children: (
                <BrowserFrame
                  shot="client-review-portal"
                  motion="none"
                  caption="studio-flows.com/r/shared-link"
                  alt="The client review portal: a pack shot with numbered comment pins and the comment thread beside it."
                  sizes="(min-width: 1200px) 1100px, 100vw"
                />
              ),
            },
            {
              eyebrow: "Shooting schedule",
              title: "The day re-flows itself.",
              body: "Change one scene and every time after it moves. Lunch holds its slot, and an overrun shows in red before it becomes a problem on set.",
              hue: "green",
              children: (
                <BrowserFrame motion="none" caption="app.studio-flows.com/projects/morning-ritual/schedule" alt="The schedule editor re-flowing a day around a fixed lunch.">
                  <DemoVideo clip="schedule-reflow" hue="green" alt="Lengthening a scene until it runs into a fixed lunch, then unpinning lunch so the afternoon and wrap move." />
                </BrowserFrame>
              ),
            },
            {
              eyebrow: "Call sheets",
              title: "Crew confirm themselves.",
              body: "Every person gets their own link. You see who opened it and who confirmed, and the stragglers are chased for you before the shoot.",
              hue: "amber",
              children: (
                <BrowserFrame
                  shot="project-callsheet"
                  motion="none"
                  caption="app.studio-flows.com/projects/bright-water/callsheet"
                  alt="A call sheet in the builder, with the masthead, schedule and crew blocks."
                  sizes="(min-width: 1200px) 1100px, 100vw"
                />
              ),
            },
            {
              eyebrow: "Budget",
              title: "Know what the job made.",
              body: "Every invoice lands against the line it belongs to, deposits and balances included, and the margin is waiting for you at the end.",
              hue: "indigo",
              children: (
                <BrowserFrame
                  shot="project-budget"
                  motion="none"
                  caption="app.studio-flows.com/projects/bright-water/budget"
                  alt="The budget page: bid against actual by line, the cost ledger and the margin band."
                  sizes="(min-width: 1200px) 1100px, 100vw"
                />
              ),
            },
          ]}
        />

        {/* CLOSE */}
        <section className="mx-auto max-w-[1400px] px-6 pb-28 pt-8 sm:px-10">
          <div className="rounded-[32px] px-8 py-16 text-center sm:px-16" style={{ background: "linear-gradient(145deg, var(--h-indigo-bg) 0%, var(--surface-2) 70%)" }}>
            <h2 className="mx-auto max-w-3xl font-display text-5xl font-extrabold leading-[1.0] tracking-[-0.02em] text-text sm:text-6xl">
              Run your next job through it.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
              The free plan runs a whole job, brief to invoice. No card needed.
            </p>
            <div className="mt-8 flex justify-center">
              <CtaButton shine />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
