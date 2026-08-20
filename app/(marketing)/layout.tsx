import type { Metadata } from "next";
import { MarketingNav, MarketingFooter } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "Studio Flows | One home for the whole job",
  description:
    "Brief, boards, versions, client approvals, call sheets and budget in one place. Pre-production, review and delivery for boutique commercial studios.",
};

/**
 * Outward-facing pages are pinned to the PAPER ground.
 *
 * The brand sheet fixes this: the product offers light, paper and dark and the
 * user chooses, but the marketing surfaces commit to the warm one, because the
 * argument they are making (an interface that does not compete with the work
 * being judged) stops being visible the moment the page can invert.
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
    <div data-theme="paper" className="min-h-screen bg-bg font-body text-text">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
