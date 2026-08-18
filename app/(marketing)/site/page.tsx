import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/icon-tile";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { HeroAnimation } from "@/components/marketing/hero-animation";
import { PersonaChips } from "@/components/marketing/persona-chips";
import {
  FeatureRow,
  Section,
  SectionHeader,
} from "@/components/marketing/section";

/* The four phase bands, in the same order and hues the project hub uses, so the
   site previews the product's own mental model rather than inventing one. */
const PHASES = [
  {
    hue: "indigo",
    name: "Plan",
    body: "The brief, the references, and every file for the job in one library.",
    icon: (
      <path
        d="M4 3.5h8l3 3v10H4z M12 3.5V7h3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    hue: "purple",
    name: "Visualize",
    body: "Storyboards, shot lists, and moodboards that stay tied to the job.",
    icon: (
      <path
        d="M3 4.5h14v11H3z M3 9h14 M8 4.5v11"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    hue: "green",
    name: "Review",
    body: "Client approvals with pinned comments, versions, and a clear yes.",
    icon: (
      <path
        d="M4 10.5 8 14l8-8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    hue: "amber",
    name: "Produce",
    body: "Call sheets, crew, budget, and delivery, all on the same spine.",
    icon: (
      <path
        d="M3 6.5h14v10H3z M3 6.5 6 3h8l3 3.5 M7 10h6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
];

/* The page is reachable at /site on the app and preview hosts as well as at "/"
   on the apex, so it names the apex as canonical and search never has to pick. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

const STEPS = [
  { n: "01", t: "Win the job", b: "Track the deal from first contact to awarded." },
  { n: "02", t: "Build it out", b: "Brief, boards, shot list, crew, and schedule." },
  { n: "03", t: "Get the yes", b: "Share a link, collect notes, lock the version." },
  { n: "04", t: "Deliver and close", b: "Call sheets, costs, margin, final files." },
];

function PhaseCard({
  hue,
  name,
  body,
  icon,
}: {
  hue: string;
  name: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    // Colored top edge + hue-tinted wash, the same bolder language the app's
    // own board columns and page headers already use.
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      style={{ borderTop: `3px solid var(--h-${hue})` }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-60"
        style={{
          background: `linear-gradient(to bottom, var(--h-${hue}-bg), transparent)`,
        }}
      />
      <div className="relative">
        <IconTile hue={hue} size="lg">
          <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
            {icon}
          </svg>
        </IconTile>
        <h3 className="mt-5 font-display text-xl font-bold text-text">{name}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-text-muted">
          {body}
        </p>
      </div>
    </div>
  );
}

function FeatureCopy({
  eyebrow,
  title,
  body,
  points,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        {eyebrow}
      </p>
      <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-text sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
        {body}
      </p>
      <ul className="mt-7 space-y-3.5">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[15px] text-text">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              className="mt-0.5 shrink-0 text-accent"
              aria-hidden="true"
            >
              <path
                d="M4 10.5 8 14l8-8"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-16 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            For production studios of every scale
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-7xl lg:text-[5.25rem]">
            Every job, in one place.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-text-muted sm:text-2xl">
            Studio Flows pulls your briefs, boards, client approvals, call
            sheets, and budgets into one organized home, built around how
            commercial production actually works.
          </p>
          <PersonaChips className="mt-7" />

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaButton shine />
              <CtaButton variant="quiet" href="/#product" label="See how it works" />
            </div>
            <CtaMicrocopy />
          </div>
        </div>

        <div className="mt-16">
          <BrowserFrame
            caption="studio-flows.com/r/hint-summer-hero-v2"
            alt="A client review in progress."
          >
            <HeroAnimation />
          </BrowserFrame>
        </div>
      </Section>

      {/* Proof bar. A logo row goes here once real studios can be named; until
          then the honest proof is where this came from. */}
      <Section tint="tinted" className="py-14 sm:py-16">
        <p className="mx-auto max-w-2xl text-center text-[15px] leading-relaxed text-text-muted">
          Built inside a working commercial studio and run on real client jobs
          before it was offered to anyone else.
        </p>
      </Section>

      {/* Phase bands */}
      <Section>
        <div id="product" className="scroll-mt-24">
          <SectionHeader
            eyebrow="The shape of it"
            title="Shaped like a production, because it is one."
            sub="Not a blank board you configure into a studio. The phases of a job are the structure, from the first brief to the final invoice."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PHASES.map((p) => (
              <PhaseCard key={p.name} {...p} />
            ))}
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section tint="tinted">
        <div id="how" className="scroll-mt-24">
          <SectionHeader
            eyebrow="How it works"
            title="One spine, first contact to final delivery."
          />
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-display text-sm font-extrabold tracking-widest text-accent">
                  {s.n}
                </span>
                <h3 className="mt-3 font-display text-lg font-bold text-text">
                  {s.t}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Feature A: client review */}
      <Section>
        <div id="review" className="scroll-mt-24">
          <FeatureRow
            visual={
              <BrowserFrame
                caption="studio-flows.com/r/shared-link"
                hue="green"
                alt="The client review portal: a hero frame with two numbered comment pins and the comment rail beside it."
              />
            }
          >
            <FeatureCopy
              eyebrow="Client review"
              title="Approvals your clients will actually use."
              body="Send a link. No login, no account, no explaining. Feedback lands on the frame it belongs to instead of dying in an email thread."
              points={[
                "Pinned comments on a still, timecode comments on a cut",
                "Draw straight on the frame when words are slower",
                "Every version kept, nothing overwritten",
                "Approve or request changes in one click",
              ]}
            />
          </FeatureRow>
        </div>
      </Section>

      {/* Feature B: production */}
      <Section tint="tinted">
        <div id="production" className="scroll-mt-24">
          <FeatureRow
            flip
            visual={
              <BrowserFrame
                caption="app.studio-flows.com/projects/hint-summer/callsheet"
                hue="amber"
                alt="A storyboard frame grid beside a call sheet showing per-recipient confirmed chips."
              />
            }
          >
            <FeatureCopy
              eyebrow="Production"
              title="Shot lists and call sheets that stay in sync."
              body="Build the boards, pull them into a shot list, send the call sheet. One job, one spine, nothing retyped between tools."
              points={[
                "Storyboards, shot lists, and moodboards on the job",
                "Call sheets with per-recipient view and confirm tracking",
                "A crew roster with positions, rates, and contacts",
                "Crew see the work, never the numbers",
              ]}
            />
          </FeatureRow>
        </div>
      </Section>

      {/* Feature C: money */}
      <Section>
        <div id="budget" className="scroll-mt-24">
          <FeatureRow
            visual={
              <BrowserFrame
                caption="app.studio-flows.com/projects/hint-summer/budget"
                hue="blue"
                alt="The budget page: bid versus actual lines, the cost ledger, and the margin band."
              />
            }
          >
            <FeatureCopy
              eyebrow="Budget"
              title="Know where the job stands, and what it made."
              body="Bid against actual, with every cost backed by the invoice it came from. Not a number you typed and cannot explain."
              points={[
                "A cost ledger with the invoice attached to each line",
                "Deposits and payment schedules, so owed is precise",
                "Margin on the job, billed against what it cost",
                "Log a cost straight from an emailed invoice",
              ]}
            />
          </FeatureRow>
        </div>
      </Section>

      {/* Feature D: AI pipeline. The one dramatic band on the page. */}
      <Section tint="accent">
        <div id="pipeline" className="scroll-mt-24">
          <FeatureRow
            flip
            visual={
              <BrowserFrame
                caption="app.studio-flows.com/projects/hint-summer/pipeline"
                hue="purple"
                alt="The AI pipeline triage view: a large candidate on stage with the filmstrip of takes below and provenance in the sidebar."
              />
            }
          >
            <FeatureCopy
              eyebrow="AI pipeline"
              title="Made for the AI era of production."
              body="Generation tools give you a hundred candidates and no way to judge them. Studio Flows organizes the fan-out so a pick takes minutes."
              points={[
                "Triage a batch keyboard-first, star the shortlist",
                "Provenance on every clip: platform, model, seed, prompt",
                "Send a batch link and let the client pick the take",
                "We organize. Your tools generate.",
              ]}
            />
          </FeatureRow>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="text-center">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
          Run your next job in Studio Flows.
        </h2>
        <div className="mt-8 flex flex-col items-center gap-4">
          <CtaButton />
          <CtaMicrocopy />
        </div>
      </Section>
    </>
  );
}
