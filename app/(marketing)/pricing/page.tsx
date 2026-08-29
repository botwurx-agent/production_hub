import type { Metadata } from "next";
import Link from "next/link";
import { Wash } from "@/components/marketing/aurora";
import { CtaButton } from "@/components/marketing/cta";
import { Section, SectionHeader } from "@/components/marketing/section";
import { BillingProvider, BillingToggle } from "@/components/marketing/pricing/billing";
import { PlanCards } from "@/components/marketing/pricing/plan-cards";
import { CompareTable } from "@/components/marketing/pricing/compare-table";
import { PricingFaq } from "@/components/marketing/pricing/faq";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One price for the whole production toolkit. Client review and crew access are free on every plan. Start with one project free, no card.",
  alternates: { canonical: "/pricing" },
};

/**
 * The pricing page.
 *
 * The argument it makes, in order: the entry plan is the WHOLE product rather
 * than a demo with a price on it, the free plan runs a whole job rather than a
 * hobbled one, the extra tiers are room and money tooling rather than
 * permission, and the people who cost you nothing (crew, clients)
 * are named before anyone has to ask.
 *
 * NO free-forever tier and NO "contact sales", both on purpose. A free tier in
 * this category generates a whole class of support ("how do I downgrade back to
 * free") and a sales wall on the top plan quietly tells the middle plan it is
 * the cheap option, which contradicts a product built for studios of every
 * scale. What replaces the free tier is one project free, with no clock on it,
 * because a production job runs for weeks and a fourteen-day trial expires
 * before the client has even seen a cut.
 *
 * BillingProvider wraps both bands so the cards and the comparison table's
 * pinned header can never disagree about a price. Everything inside it that
 * does not read the toggle stays a server component.
 */
export default function PricingPage() {
  return (
    <>
      <BillingProvider>
        <Section className="pt-14 sm:pt-16">
          <SectionHeader
            eyebrow="Pricing"
            title="The whole toolkit, at every price."
            sub="Nothing here is a demo. The free plan runs a whole job, from the first brief through client sign-off and delivery. The ones above it buy room and the money side, not permission."
          />
          <BillingToggle className="mt-10" />
          <div className="mt-12">
            <PlanCards />
          </div>
        </Section>

        <Section id="compare" backdrop={<Wash hue="indigo" />}>
          <CompareTable />
        </Section>
      </BillingProvider>

      <Section tint="tinted">
        <SectionHeader eyebrow="Questions" title="The things worth asking." />
        <div className="mt-14">
          <PricingFaq />
        </div>
        <p className="mx-auto mt-12 max-w-xl text-center text-[15px] leading-relaxed text-text-muted">
          Something not answered here?{" "}
          <a
            href="mailto:studioflows1@gmail.com"
            className="font-semibold text-accent underline underline-offset-4"
          >
            Write to us
          </a>{" "}
          and you will get an answer from the person building it.
        </p>
      </Section>

      <Section className="text-center" backdrop={<Wash hue="green" />}>
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
          Run your next job in Studio Flows.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
          Your first project is free, with no card and no countdown. Pick a plan
          when there is a second job to run.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <CtaButton shine />
          <p className="text-sm text-text-faint">
            Not sure yet?{" "}
            <Link href="/#product" className="underline underline-offset-4 hover:text-text-muted">
              See what a project holds
            </Link>
          </p>
        </div>
      </Section>
    </>
  );
}
