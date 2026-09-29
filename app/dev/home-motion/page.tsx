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
import Link from "next/link";
import { HeroShowcase, LiveScene } from "@/components/marketing/scene-stage";
import { JobPath } from "@/components/marketing/job-path";
import { StackPanels } from "@/components/marketing/stack-panels";
import { Section, SectionHeader } from "@/components/marketing/section";
import { ModuleMap } from "@/components/marketing/module-map";
import { Wash } from "@/components/marketing/aurora";
import { Ticker } from "@/components/marketing/ticker";

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
            <HeroShowcase />
          </div>
        </section>

        {/* INSIDE A PROJECT, kept from the live home page at the operator's
            request (2026-09-29): the module map is the one section that shows
            the whole product at once. */}
        <Section id="product" backdrop={<Wash hue="indigo" />}>
          <SectionHeader
            eyebrow="Inside a project"
            title="Everything it takes to run the job, on one page."
            sub="A project here is not a folder. It is the whole production: the brief, the boards, the crew, the money and the delivery, each waiting in the phase where the work happens."
          />
          <div className="mt-16">
            <ModuleMap />
          </div>
          <div className="mt-12 text-center">
            <Link href="/production-hub" className="text-[15px] font-semibold text-accent">
              More about the project hub
            </Link>
          </div>
        </Section>

        {/* THE JOB'S PATH: drawn by the scroll. */}
        <div id="path">
          <JobPath cta={<CtaButton size="sm" />} />
        </div>

        {/* FEATURES: panels that slide up over each other. */}
        <StackPanels
          panels={[
            {
              eyebrow: "Storyboards and shot lists",
              title: "From pencils to a shot list.",
              body: "Frames go from sketch to final on the board, and every frame becomes a shot with its size and move, ready for the day.",
              hue: "purple",
              children: <LiveScene name="storyboard" className="h-full" />,
            },
            {
              eyebrow: "Shooting schedule",
              title: "The day re\u2011flows itself.",
              body: "Change one scene and every time after it moves. Lunch holds its slot, and an overrun shows in red before it becomes a problem on set.",
              hue: "green",
              children: <LiveScene name="schedule" className="h-full" />,
            },
            {
              eyebrow: "Communication",
              title: "Every thread, filed with the job.",
              body: "Gmail, Slack and Google Chat on the project they belong to. Reply from here, file the attachment, and the conversation stays where it always was.",
              hue: "cyan",
              children: <LiveScene name="comms" className="h-full" />,
            },
            {
              eyebrow: "AI pipeline",
              title: "A hundred generations, one pick.",
              body: "Import every take from the tools you generate in. Reject, star and pick with provenance on each one, let the client choose, and drop the winner into the sequence.",
              hue: "pink",
              children: <LiveScene name="pipeline" className="h-full" />,
            },
          ]}
        />

        {/* CLOSE */}
        <section className="mx-auto max-w-[1400px] px-6 pb-16 pt-8 sm:px-10">
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
        {/* THE RUNNING LINE, under the close and above the footer, the way
            monday.com ends its page (operator, 2026-09-29). */}
        <Ticker
          items={[
            "Spreadsheets store your job. Studio Flows runs it.",
            "Approvals that do not get lost.",
            "Call sheets that confirm themselves.",
            "Every thread, filed with the job.",
            "Know what the job made.",
          ]}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
