import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import {
  getValidLink,
  gatherReview,
  gatherDocReview,
  isDocKind,
} from "@/lib/review-links";
import { ClientReview } from "@/components/review/client-review";
import { DocReview } from "@/components/review/doc-review";
import { verifyPortalToken } from "@/lib/client-portal-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Keep review links out of search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Review",
};

/**
 * A thin bar back to the client portal, shown only to a visitor who arrived
 * from it and only while it is live. The review page itself is untouched underneath it.
 */
function PortalBar({ token }: { token: string | null }) {
  if (!token) return null;
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <Link
          href={`/portal/${token}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Everything shared on this job
        </Link>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function ReviewPortalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { portal?: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          Review portal not configured
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          This review link can&apos;t be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const service = createServiceClient();
  // The visitor's browser key (set client-side on first visit), so their own
  // reactions come back marked without any login.
  const viewerKey = cookies().get("sf_rk")?.value ?? null;
  const link = await getValidLink(service, params.token);
  if (!link) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          Link not available
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          This review link is invalid, has expired, or was turned off. Please ask
          the studio for a new one.
        </p>
      </Centered>
    );
  }

  // Only for somebody who came FROM the portal, proven by the portal token
  // they bring. A single review link can be sent to someone who should see
  // only that item, so the way to everything else is never offered to them.
  const portalToken = await verifyPortalToken(
    service,
    link.project_id,
    searchParams?.portal
  ).catch(() => null);

  // Doc surfaces (shot list / storyboard / moodboard) render live with pins.
  if (isDocKind(link.target_type)) {
    const doc = await gatherDocReview(service, link, viewerKey);
    if (!doc) {
      return (
        <Centered>
          <h1 className="font-display text-xl font-bold text-text">
            Nothing to review
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            The shared item is no longer available.
          </p>
        </Centered>
      );
    }
    return (
      <>
        <PortalBar token={portalToken} />
        <DocReview token={params.token} data={doc} />
      </>
    );
  }

  const data = await gatherReview(service, link, viewerKey);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          Nothing to review
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          The shared item is no longer available.
        </p>
      </Centered>
    );
  }

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (host ? `${proto}://${host}` : "");

  return (
    <>
      <PortalBar token={portalToken} />
      <ClientReview token={params.token} origin={origin} data={data} />
    </>
  );
}
