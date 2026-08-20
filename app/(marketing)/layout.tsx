import type { Metadata } from "next";
import { MarketingNav, MarketingFooter } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Studio Flows | One home for the whole job",
  description:
    "Brief, boards, versions, client approvals, call sheets and budget in one place. Pre-production, review and delivery for boutique commercial studios.",
};

/**
 * Outward-facing pages are pinned to ONE ground so they cannot invert.
 *
 * This was PAPER, on the argument that a warm ground suits a page about not
 * competing with the work being judged. The operator chose LIGHT instead
 * (2026-08-20), so that is what ships; the earlier reasoning is kept here
 * because it is the thing to weigh again if the brand ever revisits it.
 *
 * data-theme is an attribute selector in globals.css rather than an html-only
 * rule, so setting it on this wrapper resolves every token underneath it
 * without touching the app's own theme handling.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="min-h-screen bg-bg font-body text-text">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
