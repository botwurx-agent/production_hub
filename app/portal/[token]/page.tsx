import type { Metadata } from "next";
import { serviceConfigured } from "@/lib/supabase/service";
import { loadPortalByToken, recordPortalView } from "@/lib/client-portal-data";
import { ClientPortalView } from "@/components/review/client-portal-view";
import { liveRequestTokenForClient } from "@/lib/request-links";

export const dynamic = "force-dynamic";

// A private link for one client, so it stays out of search results even
// though the token is what actually guards it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Your review portal",
};

/**
 * The client portal: one no-login link per project listing everything the
 * studio has shared for review, sorted by what is waiting on the client.
 * Each item opens its own /r/<token> review exactly as before.
 */
export default async function ClientPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const view = serviceConfigured() ? await loadPortalByToken(params.token) : null;
  if (!view) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link is invalid or was turned off. Please ask the studio for a
          new one.
        </p>
      </div>
    );
  }
  // Best effort: a failed stamp must never fail the page a client is reading.
  void recordPortalView(params.token).catch(() => {});
  // The client's own request link, offered here because whoever holds this
  // portal is already that client. Absent when the studio has not made one.
  const requestToken = await liveRequestTokenForClient(view.clientId);
  return (
    <ClientPortalView
      view={view}
      todayIso={new Date().toISOString().slice(0, 10)}
      portalToken={params.token}
      requestHref={requestToken ? `/request/${requestToken}` : null}
    />
  );
}
