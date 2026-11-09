import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { Wash } from "@/components/marketing/aurora";
import { HelpBrowser, type HelpCard } from "@/components/marketing/help/help-browser";
import { helpMediaExists } from "@/components/marketing/help/help-media";
import { HELP_ARTICLES, HELP_CATEGORIES, helpArticle, searchText } from "@/lib/help/articles";

/**
 * The help center index.
 *
 * TWO COLUMNS IN THE FOLD, per section 4.6: the heading and what this is on the
 * left, a "start here" panel on the right, so the first screen already answers
 * the commonest question (how do I begin) instead of being a centred title.
 * Below it, the searchable, filterable grid of every guide.
 *
 * Everything reads from lib/help/articles.ts. Card thumbnails are only the
 * real screenshots that exist on disk, checked here on the server.
 */

const DESCRIPTION =
  "Step-by-step guides to everything in Studio Flows: projects, shot lists, storyboards, client review, call sheets, budgets, invoicing, the CRM and the AI tools.";

export const metadata: Metadata = {
  title: "Help center",
  description: DESCRIPTION,
  alternates: { canonical: "/help" },
  openGraph: { title: "Help center | Studio Flows", description: DESCRIPTION, url: "/help", type: "website" },
  twitter: { card: "summary_large_image", title: "Help center | Studio Flows", description: DESCRIPTION },
};

const START_HERE = ["create-your-account", "start-a-project", "share-for-client-review", "send-a-call-sheet", "invite-your-team"];

export default function HelpIndex() {
  const cards: HelpCard[] = HELP_ARTICLES.map((a) => {
    const lead = a.hero ?? a.steps.find((s) => s.media)?.media;
    const has = helpMediaExists(lead);
    return {
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      category: a.category,
      minutes: a.minutes,
      steps: a.steps.length,
      stepTitles: a.steps.map((s) => s.title),
      text: searchText(a),
      thumb: has ? (lead!.clip ? `/marketing/demos/${lead!.clip}.jpg` : `/marketing/shots/${lead!.shot}.png`) : undefined,
      video: has && !!lead!.clip,
    };
  });

  return (
    <>
      <Section backdrop={<Wash hue="indigo" />} className="!pb-10 sm:!pb-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-accent">Help center</p>
            <h1 className="mt-4 font-display text-[44px] font-extrabold leading-[1.04] tracking-tight text-text sm:text-[60px]">
              Everything Studio Flows does, step by step.
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-text-muted">
              {HELP_ARTICLES.length} guides with real screenshots, from your first project to paying the crew.
              Search for what you need, or filter by part of the job.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_18px_50px_-28px_rgba(20,20,40,0.35)]">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-text-faint">New here? Start with these</p>
            <ol className="mt-4 divide-y divide-border">
              {START_HERE.map((slug, i) => {
                const a = helpArticle(slug);
                if (!a) return null;
                return (
                  <li key={slug}>
                    <Link href={`/help/${slug}`} className="group flex items-start gap-4 py-3.5">
                      <span className="font-display text-[22px] font-extrabold leading-none text-border-strong group-hover:text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="block font-display text-[16px] font-bold text-text group-hover:text-accent">{a.title}</span>
                        <span className="mt-0.5 block text-[14px] text-text-muted">{a.summary}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </Section>

      <Section className="!pt-0">
        <HelpBrowser categories={HELP_CATEGORIES} cards={cards} />

        <div className="mt-20 grid gap-6 rounded-2xl border border-border bg-accent-soft p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">Still stuck?</h2>
            <p className="mt-2 text-[16px] text-text-muted">
              Inside the app, open your avatar menu and choose Send feedback. Or write to us and a person will answer.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </Section>
    </>
  );
}
