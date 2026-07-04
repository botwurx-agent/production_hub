import { headers } from "next/headers";
import type { Metadata } from "next";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { getValidLink, gatherReview } from "@/lib/review-links";
import { ClientReview } from "@/components/review/client-review";

export const dynamic = "force-dynamic";

// Keep review links out of search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Review",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function ReviewPortalPage({
  params,
}: {
  params: { token: string };
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

  const data = await gatherReview(service, link);
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

  return <ClientReview token={params.token} origin={origin} data={data} />;
}
