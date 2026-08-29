import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Wash } from "@/components/marketing/aurora";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { ModuleMap } from "@/components/marketing/module-map";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { PersonaChips } from "@/components/marketing/persona-chips";
import { ScatterConverge } from "@/components/marketing/scatter-converge";
import Link from "next/link";
import {
  FeatureRow,
  PointList,
  Section,
  SectionHeader,
} from "@/components/marketing/section";

/* The app host redirects "/" to the dashboard or login, so this page is only
   ever the apex. Naming it canonical keeps any stray preview URL from competing
   with the real one in search. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

function FeatureCopy({
  eyebrow,
  title,
  body,
  points,
  more,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  /** Link to the feature's dedicated page under /features. */
  more?: { href: string; label: string };
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
      <PointList points={points} className="mt-7" />
      {more ? <MoreLink href={more.href} label={more.label} className="mt-7" /> : null}
    </div>
  );
}

/** The quiet "keep reading" arrow into a /features page. */
function MoreLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent transition hover:gap-2.5 ${className}`}
    >
      {label}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/**
 * A product shot that carries its own claim, for a section making two separate
 * promises that one frame cannot hold.
 *
 * The heading sits UNDER the shot on purpose: the picture is the evidence and
 * the words are its caption, which is the opposite of FeatureRow, where the
 * copy leads and the shot supports it.
 */
function ProofColumn({
  shot,
  caption,
  alt,
  hue,
  title,
  points,
}: {
  shot: string;
  caption: string;
  alt: string;
  hue: string;
  title: string;
  points: string[];
}) {
  return (
    <div>
      <BrowserFrame shot={shot} caption={caption} alt={alt} hue={hue} />
      <h3 className="mt-7 font-display text-2xl font-extrabold tracking-tight text-text">
        {title}
      </h3>
      <PointList points={points} />
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
            Every job, in{" "}
            {/* Highlighter swash, from the comp: the phrase goes accent and a
                rounded accent-soft bar sits behind its lower third. Behind, via
                a negative z-index, so the type stays crisp instead of being
                overlaid. nowrap keeps the bar from breaking across two lines. */}
            <span className="relative whitespace-nowrap text-accent">
              {/* A marker stroke, not a rounded rectangle. The edges are uneven
                  and the ends taper, because a highlighter never lays down a
                  bar of even thickness, and the whole thing tilts under a
                  degree so it does not sit dead level with the baseline.

                  preserveAspectRatio="none" lets one path stretch to any phrase
                  width. Drawn FIRST in the DOM with the words after it in their
                  own positioned span, so paint order alone keeps the type on
                  top: a negative z-index would work today and break the moment
                  an ancestor gained a stacking context, and the section wrapper
                  already has one. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 300 60"
                preserveAspectRatio="none"
                className="absolute -left-[0.12em] bottom-[0.015em] h-[0.4em] w-[calc(100%+0.24em)] -rotate-[1.1deg]"
                style={{
                  // Translucent, like a real highlighter laid over type, rather
                  // than a solid block the words sit on top of.
                  fill: "color-mix(in oklch, var(--accent) 30%, transparent)",
                }}
              >
                <path d="M4 34 C60 19 102 13 150 13 C199 13 251 18 296 24 L296 43 C250 38 199 36 150 36 C101 36 55 45 4 53 Z" />
              </svg>
              <span className="relative">one place</span>
            </span>
            .
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

        {/* Held in from the 1400px container to 1200. At full width the shot
            filled the fold on a laptop and pushed the sections below out of
            sight, so it read as the page rather than as evidence for the
            headline above it. */}
        <div className="mx-auto mt-16 max-w-[1200px]">
          <BrowserFrame
            priority
            // Already on screen at load, so a scroll timeline would never fire.
            motion="settle"
            // Wider than the frames that share a row with copy, so it has to
            // say so. 1280 is where the container stops growing: below that it
            // is the viewport minus the section's 40px of side padding.
            sizes="(min-width: 1280px) 1200px, 100vw"
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
          title="A job lives in too many places at once."
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
      {/* The shape. This was four abstract tiles and no product, which made it
          the one section asserting something the page never showed. The hub IS
          the claim: the phases are literally how a job opens. So the shot
          leads and the four phases become its key. */}
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
          <MoreLink href="/production-hub" label="More about the project hub" />
        </div>
      </Section>

      {/* Communication sits directly above client review because the two are one
          argument read in order: this is where the conversation lives, and that
          is where the decision gets made. It also states the connect-don't-
          replace principle out loud, which nothing else on the page does. */}
      <Section id="communication" tint="tinted">
        <FeatureRow
          flip
          visual={
            <BrowserFrame
              caption="app.studio-flows.com/projects/bright-water/communication"
              shot="project-communication"
              hue="cyan"
              alt="The Communication page: linked Gmail threads, Slack channels and a Google Chat space, all on one project."
            />
          }
        >
          <FeatureCopy
            eyebrow="Communication"
            title="The thread about the job, filed with the job."
            body="Nobody is going to move their client onto a new chat app, so we do not ask. Link the Gmail thread, the Slack channel, the Chat space, and read and reply to all of it from the project it belongs to."
            more={{ href: "/production-communication", label: "More about Communication" }}
            points={[
              "Gmail, Slack and Google Chat, side by side on one page",
              "Reply without leaving the job, attachments and all",
              "An unread count per conversation, so nothing sits unseen",
              "Pull an attachment straight into the assets, documents or the budget",
              "The whole conversation still lives where it always did",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Client review: the sharpest thing the product does, so it leads. */}
      <Section id="review" backdrop={<Wash hue="green" />}>
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
            more={{ href: "/video-review-software", label: "More about Client review" }}
            points={[
              "Pin a comment to a spot on a still, or to a moment in a cut",
              "Draw on the frame when words are slower than a circle",
              "Every version kept, with the notes that belong to it",
              "Switch between versions on the same page, a click apart",
              "Approve or request changes in one click, on the record",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Shoot day. The most concrete proof that this was built on set. */}
      <Section id="production" tint="tinted" backdrop={<Wash hue="amber" />}>
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
            more={{ href: "/call-sheet-software", label: "More about Call sheets & shot lists" }}
            points={[
              "Per-person call sheet links with view and confirm tracking",
              "Crew roster with positions, rates, and contacts",
              "Storyboards and shot lists that feed the sheet, nothing retyped",
              "Crew lunch: paste the group order link, we chase the stragglers",
            ]}
          />
        </FeatureRow>
      </Section>

      {/* Money. Two separate promises: what the job COST and what the client is
          BILLED. They live on different pages and neither one evidences the
          other, so this band breaks the alternating rhythm and gives each its
          own frame rather than cramming both into one column. */}
      <Section id="budget" backdrop={<Wash hue="blue" />}>
        <SectionHeader
          eyebrow="The money"
          title="Know what the job made."
          sub="Every cost backed by the invoice it came from, every document sent from the same place. Not a number you typed once and cannot explain three weeks later."
        />
        <div className="mt-16 grid gap-14 lg:grid-cols-2 lg:gap-12">
          <ProofColumn
            shot="project-budget"
            caption="app.studio-flows.com/projects/bright-water/budget"
            hue="blue"
            alt="The budget page: bid against actual, the cost ledger beneath it, and the margin band."
            title="What it cost"
            points={[
              "Bid against actual, line by line",
              "A cost ledger with the invoice attached to each entry",
              "Deposits and payment schedules, so what is owed is exact",
              "Margin on the job: what you billed against what it cost",
            ]}
          />
          <ProofColumn
            shot="project-invoices"
            caption="app.studio-flows.com/projects/bright-water/invoices"
            hue="green"
            alt="The document workspace: an estimate, a signed proposal, and an invoice, with the document edited in place beside them."
            title="What you billed"
            points={[
              "Estimates, proposals, and invoices, in your own numbering",
              "Proposals signed online, with the audit trail behind it",
              "Sent as a link, an email, or a PDF",
              "Your layout, your color, your terms",
            ]}
          />
        </div>
        <div className="mt-12 text-center">
          <MoreLink href="/production-budgeting-software" label="More about budget & invoicing" />
        </div>
      </Section>

      {/* AI pipeline. Shipped, which is the point worth making loudly. */}
      <Section id="pipeline" tint="accent" backdrop={<Wash hue="purple" />}>
        <FeatureRow
          flip
          visual={
            <BrowserFrame
              // Bright Water is a live-action commercial in the demo, so the
              // pipeline does not exist on it. Pointing the caption at the
              // ai_video project keeps the URL honest.
              caption="app.studio-flows.com/projects/lumen-concept-reel/pipeline"
              shot="project-pipeline"
              hue="purple"
              alt="The AI pipeline: generated candidates for a shot, with provenance on every clip."
            />
          }
        >
          <FeatureCopy
            eyebrow="AI pipeline, shipped"
            title="Made for the AI era of production."
            body="Generation tools hand you a hundred candidates and no way to judge them. Studio Flows organizes the fan-out so picking a take takes minutes, not an afternoon."
            more={{ href: "/ai-video-production", label: "More about the AI pipeline" }}
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
              // No URL in the caption on purpose: Runner is a panel that opens
              // over whatever you are reading, not a page you navigate to, and
              // a fake path would say the opposite.
              caption="Runner"
              shot="runner-panel"
              hue="cyan"
              alt="The Runner panel proposing a cost as a card, every value listed, with Create and Cancel."
            />
          }
        >
          <FeatureCopy
            eyebrow="Runner"
            title="An assistant that never goes behind your back."
            body="Ask it anything about the studio and it reads the real data to answer. When it wants to change something it writes a card listing every value, and waits for you to press Create."
            more={{ href: "/runner", label: "More about Runner" }}
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
