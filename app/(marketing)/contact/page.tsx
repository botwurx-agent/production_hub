import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { Wash } from "@/components/marketing/aurora";
import { ContactForm } from "@/components/marketing/contact-form";
import { APP_ORIGIN } from "@/lib/marketing/hosts";

/**
 * Contact.
 *
 * TWO COLUMNS, NOT A CENTRED STACK, per section 4.6 of CLAUDE.md: words left,
 * the thing you came to do on the right, filling the fold. A contact page is
 * where that rule matters most, because the form IS the page's evidence and
 * centring it under a heading is the template look the rule exists to refuse.
 *
 * THE LEFT COLUMN IS NOT DECORATION. Most people arriving here do not actually
 * need the form, and sending them through it costs them a day of waiting for
 * an answer they could have had immediately. So the routes that are faster
 * than writing to us are stated FIRST and in full: a customer with a problem
 * wants the in-app feedback button, somebody comparing plans wants the pricing
 * page, and anybody who would rather just send an email is given the address
 * rather than made to use a form to get it.
 */

const INBOX = "studioflows1@gmail.com";

const DESCRIPTION =
  "Talk to the person building Studio Flows. Questions about running a job on it, pricing, security, or a walkthrough of the product.";

export const metadata: Metadata = {
  title: "Contact",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | Studio Flows",
    description: DESCRIPTION,
    url: "/contact",
    type: "website",
  },
  // Restated because Next replaces a parent's `twitter` object rather than
  // merging into it. See the note on the feature page.
  twitter: {
    card: "summary_large_image",
    title: "Contact | Studio Flows",
    description: DESCRIPTION,
  },
};

/** A faster route than the form, for the people who have one. */
function Route({
  hue,
  title,
  body,
  href,
  label,
  external,
}: {
  hue: string;
  title: string;
  body: string;
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <li className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-2.5">
        <span
          className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: `var(--h-${hue})` }}
          aria-hidden
        />
        <div>
          <h3 className="font-display text-[17px] font-bold tracking-tight text-text">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-text-muted">{body}</p>
          {external ? (
            <a
              href={href}
              className="mt-2 inline-block text-[15px] font-semibold text-accent hover:underline"
            >
              {label}
            </a>
          ) : (
            <Link
              href={href}
              className="mt-2 inline-block text-[15px] font-semibold text-accent hover:underline"
            >
              {label}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ContactPage() {
  return (
    <>
      <Section className="pt-10 sm:pt-16" backdrop={<Wash hue="indigo" />}>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Contact
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-6xl">
              Talk to the person who built it.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
              Studio Flows is made by a working commercial production studio,
              and the messages come to us rather than to a support queue. Tell
              us what you are shooting and what is getting in the way.
            </p>

            <div className="mt-10 rounded-[20px] border border-border bg-surface p-6 sm:p-7">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                Faster than the form
              </p>
              <ul className="mt-5">
                <Route
                  hue="green"
                  title="Already using it and something is wrong"
                  body="Use the Feedback item in the user menu inside the app. It arrives with your studio and the page you were on attached, which is most of the diagnosis."
                  href={`${APP_ORIGIN}/login`}
                  label="Open Studio Flows"
                  external
                />
                <Route
                  hue="blue"
                  title="Working out which plan you need"
                  body="The full comparison is on the pricing page, including what the free plan runs and what a seat means. Ten written answers underneath it cover most of what people write in to ask."
                  href="/pricing"
                  label="See pricing and FAQs"
                />
                <Route
                  hue="purple"
                  title="Wondering whether it does a particular thing"
                  body="Every part of the product has its own page with real screenshots of the real app. It is quicker to look than to wait on us."
                  href="/features"
                  label="Browse the features"
                />
              </ul>
            </div>
          </div>

          {/* The form, then the way round it. The direct address sits UNDER
              THE FORM rather than in the left column, for two reasons: it is
              what somebody who has decided not to fill in a form is looking
              at, and the left column ran 450px longer than the right, which
              is the emptiness section 4.6 refuses. */}
          <div className="flex flex-col gap-5">
            <ContactForm inbox={INBOX} />

            <div className="rounded-[20px] border border-border bg-surface-2 p-6 sm:p-7">
              <h2 className="font-display text-[17px] font-bold tracking-tight text-text">
                Or just send an email
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
                <a className="font-semibold text-accent hover:underline" href={`mailto:${INBOX}`}>
                  {INBOX}
                </a>{" "}
                reaches the same place. For a security review or a vendor
                questionnaire, say so in the subject and it gets answered
                first.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
