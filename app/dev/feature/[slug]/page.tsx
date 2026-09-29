// PREVIEW of a feature page in its CHAPTER form (lib/marketing/chapters.ts),
// inside the real marketing shell. The live page at /<slug> is unchanged until
// the operator approves and the slug is added to LIVE_CHAPTER_PAGES.
// Auth-gated in production by the /dev/* rule.
import "../../../(marketing)/marketing.css";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Aurora } from "@/components/marketing/aurora";
import { FeaturePageView } from "@/components/marketing/feature-page-view";
import { featureBySlug } from "@/lib/marketing/features";
import { chaptersFor } from "@/lib/marketing/chapters";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();
  return (
    <div data-theme="light" data-accent="indigo" className="relative flex min-h-screen flex-col bg-bg font-body text-text">
      <Aurora />
      <SiteNav />
      <main className="relative z-10 flex-1">
        <FeaturePageView f={f} chapters={chaptersFor(f.slug)} />
      </main>
      <SiteFooter />
    </div>
  );
}
