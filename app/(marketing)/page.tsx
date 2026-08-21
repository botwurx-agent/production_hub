import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Wash } from "@/components/marketing/aurora";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { PersonaChips } from "@/components/marketing/persona-chips";
import { ScatterConverge } from "@/components/marketing/scatter-converge";
import {
  FeatureRow,
  Section,
  SectionHeader,
} from "@/components/marketing/section";

/* The app host redirects "/" to the dashboard or login, so this page is only
   ever the apex. Naming it canonical keeps any stray preview URL from competing
   with the real one in search. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

/* The four phases, in the order and hues the project hub itself uses, so the
   site previews the product's mental model rather than inventing one. Each
   carries a second hue for the gradient tile. */
const PHASES = [
  {
    hue: "indigo",
    to: "purple",
    name: "Plan",
    body: "The brief, the references, and every file for the job in one library.",
    icon: "M4 3.5h8l3 3v10H4z M12 3.5V7h3",
  },
  {
    hue: "purple",
    to: "pink",
    name: "Visualize",
    body: "Storyboards, shot lists, and moodboards that stay tied to the job.",
    icon: "M3 4.5h14v11H3z M3 9h14 M8 4.5v11",
  },
  {
    hue: "green",
    to: "cyan",
    name: "Review",
    body: "Client approvals with pinned notes, versions, and a clear yes.",
    icon: "M4 10.5 8 14l8-8",
  },
  {
    hue: "amber",
    to: "orange",
    name: "Produce",
    body: "Call sheets, crew, budget, and delivery on the same spine.",
    icon: "M3 6.5h14v10H3z M3 6.5 6 3h8l3 3.5 M7 10h6",
  },
];

function GradientTile({
  from,
  to,
  path,
}: {
  from: string;
  to: string;
  path: string;
}) {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] shadow-md"
      style={{
        background: `linear-gradient(135deg, var(--h-${from}), var(--h-${to}))`,
        color: "var(--accent-fg)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d={path}
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function PhaseCard({
  hue,
  to,
  name,
  body,
  icon,
}: (typeof PHASES)[number]) {
  return (
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
        <GradientTile from={hue} to={to} path={icon} />
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
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
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
      <Section className="pt-14 sm:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            For production studios of every scale
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-7xl lg:text-[5.25rem]">
            Every job, in one place.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-text-muted sm:text-2xl">
            From the first brief to the final invoice. Client approvals that do
            not get lost, call sheets that confirm themselves, and a budget that
            tells you what the job actually made.
          </p>
          <PersonaChips className="mt-7" />

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaButton shine />
              <CtaButton variant="quiet" href="/#review" label="See it work" />
            </div>
            <CtaMicrocopy />
          </div>
        </div>

        <div className="mt-16">
          <BrowserFrame
            priority
            caption="app.studio-flows.com/projects"
            shot="projects-board"
            alt="The projects board: every job on one board, moving from pre-pro to delivered."
          />
        </div>
      </Section>

      {/* The problem. Named before the product, because relief only lands on a
          wound the reader has already recognised as theirs. The picture does
          the arguing; the copy just says what you are looking at. */}
      <Section tint="tinted">
        <SectionHeader
          eyebrow="The problem"
          title="A job lives in seven places at once."
          sub="The brief is in email, the boards are in Figma, the cut is on a link someone sent last Tuesday, and the approval is in a text message. You are the only person who knows where all of it is."
        />
        <div className="mx-auto mt-14 max-w-5xl">
          <ScatterConverge />
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed text-text-muted">
          Studio Flows pulls the job into one home, and keeps talking to the
          tools your team already works in. Nobody has to stop using anything.
        </p>
      </Section>

      {/* The shape */}
      <Section id="product" backdrop={<Wash hue="indigo" />}>
        <SectionHeader
          eyebrow="The shape of it"
          title="Shaped like a production, because it is one."
          sub="Not a blank board you configure into a studio. The phases of a job are the structure, and every module hangs off the same spine."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((p) => (
            <PhaseCard key={p.name} {...p} />
          ))}
        </div>
      </Section>

      {/* Client review: the sharpest thing the product does, so it leads. */}
      <Section id="review" tint="tinted">
        <FeatureRow
          visual={
            <BrowserFrame
              caption="studio-flows.com/r/shared-link"
              shot="client-review-portal"
              hue="green"
              alt="The client review portal: a hero frame with numbered comment pins and the comment rail beside it."
            />
          }
        >
          <FeatureCopy
            eyebrow="Client review"
            title="Approvals your clients will actually use."
            body="Send a link. No login, no account, no explaining. Notes land on the frame they belong to instead of dying in an email thread."
            points={[
              "Pin a comment to a spot on a still, or to a moment in a cut",
              "Draw on the frame when words are slower than a circle",
              "Every version kept, with the notes that belong to it",
              "Approve or request changes in one click, on the record",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Shoot day. The most concrete proof that this was built on set. */}
      <Section id="production" backdrop={<Wash hue="amber" />}>
        <FeatureRow
          flip
          visual={
            <BrowserFrame
              caption="app.studio-flows.com/projects/bright-water/callsheet"
              shot="project-callsheet"
              hue="amber"
              alt="A call sheet with per-recipient confirmed chips beside the crew roster."
            />
          }
        >
          <FeatureCopy
            eyebrow="Shoot day"
            title="The chasing happens without you."
            body="Send the call sheet and the app tracks who opened it and who confirmed, then nudges the rest as the day gets close. You read a number instead of a thread."
            points={[
              "Per-person call sheet links with view and confirm tracking",
              "Crew roster with positions, rates, and contacts",
              "Storyboards and shot lists that feed the sheet, nothing retyped",
              "Crew lunch: paste the group order link, we chase the stragglers",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Money */}
      <Section id="budget" tint="tinted">
        <FeatureRow
          visual={
            <BrowserFrame
              caption="app.studio-flows.com/projects/bright-water/budget"
              shot="project-budget"
              hue="blue"
              alt="The budget page: bid against actual, the cost ledger, and the margin band."
            />
          }
        >
          <FeatureCopy
            eyebrow="The money"
            title="Know what the job made."
            body="Bid against actual, with every cost backed by the invoice it came from. Not a number you typed once and cannot explain three weeks later."
            points={[
              "A cost ledger with the invoice attached to each line",
              "Deposits and payment schedules, so what is owed is exact",
              "Estimates, proposals, and invoices, signed online",
              "Margin on the job: what you billed against what it cost",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* AI pipeline. Shipped, which is the point worth making loudly. */}
      <Section id="pipeline" tint="accent" backdrop={<Wash hue="purple" />}>
        <FeatureRow
          flip
          visual={
            <BrowserFrame
              caption="app.studio-flows.com/projects/bright-water/pipeline"
              hue="purple"
              alt="The AI pipeline triage view: a candidate on stage, a filmstrip of takes below, provenance in the sidebar."
            />
          }
        >
          <FeatureCopy
            eyebrow="AI pipeline, shipped"
            title="Made for the AI era of production."
            body="Generation tools hand you a hundred candidates and no way to judge them. Studio Flows organizes the fan-out so picking a take takes minutes, not an afternoon."
            points={[
              "Triage a batch keyboard-first, star a shortlist, pick the take",
              "Provenance on every clip: platform, model, seed, prompt",
              "Reusable elements so a character and a look hold across shots",
              "Send a link and let the client choose between takes",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Runner */}
      <Section>
        <FeatureRow
          visual={
            <BrowserFrame
              caption="Runner"
              hue="cyan"
              alt="The Runner panel proposing a change as a card, with Create and Cancel."
            />
          }
        >
          <FeatureCopy
            eyebrow="Runner"
            title="An assistant that never goes behind your back."
            body="Ask it anything about the studio and it reads the real data to answer. When it wants to change something it writes a card listing every value, and waits for you to press Create."
            points={[
              "“What is still waiting on a client?”, answered from live data",
              "“Which vendors are we late paying?”, with the amounts",
              "Proposes a cost, a task, a date. Never writes on its own",
              "Reads a supplier invoice and fills the form for you to check",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Who built it */}
      <Section tint="tinted" backdrop={<Wash hue="green" />}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Who is building it
          </p>
          <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-text sm:text-5xl">
            Built by someone carrying the same load.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-text-muted sm:text-xl">
            Fifteen years running a commercial production company: food,
            beverage, CPG, and brand work for clients who expect it perfect and
            yesterday. Every screen here came off a real job, and the product
            gets used on those jobs before anyone else is offered it.
          </p>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="text-center" backdrop={<Wash hue="indigo" />}>
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
          Run your next job in Studio Flows.
        </h2>
        <div className="mt-8 flex flex-col items-center gap-4">
          <CtaButton shine />
          <CtaMicrocopy />
        </div>
      </Section>
    </>
  );
}
