import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import "./marketing.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://studio-flows.com"),
  title: {
    default: "Studio Flows: every job, in one place",
    template: "%s | Studio Flows",
  },
  description:
    "The connected production hub for studios of every scale. Briefs, boards, client approvals, call sheets, and budgets in one organized home.",
  openGraph: {
    type: "website",
    siteName: "Studio Flows",
    url: "https://studio-flows.com",
    title: "Studio Flows: every job, in one place",
    description:
      "The connected production hub for studios of every scale.",
  },
  robots: { index: true, follow: true },
};

/**
 * The marketing shell.
 *
 * The data-theme wrapper is load-bearing, not decoration. The ROOT layout
 * injects themeInitScript into <head>, which flips <html data-theme> to the
 * visitor's stored or system preference before paint, so a visitor on a dark OS
 * would otherwise get dark marketing pages behind light-theme screenshots.
 * Every token in globals.css is declared on an ATTRIBUTE selector
 * ([data-theme="light"], [data-accent="indigo"]), which matches any element, so
 * re-declaring both here scopes the whole subtree to light without touching the
 * root script and without a flash. It also keeps these pages statically
 * rendered, which reading headers() to branch would have prevented.
 *
 * Marketing ships light-only on purpose (a controlled presentation for the
 * screenshots), the same deliberate exception the print and export views make.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme="light"
      data-accent="indigo"
      className="flex min-h-screen flex-col bg-bg font-body text-text"
    >
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
