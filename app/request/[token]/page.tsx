import type { Metadata } from "next";
import { requestLinkByToken, loadRequestPage } from "@/lib/request-links";
import { RequestPageView } from "@/components/requests/request-page-view";
import { RequestForm } from "@/components/requests/request-form";
import { submitJobRequest, finishJobRequest } from "./actions";

export const dynamic = "force-dynamic";

// A private link for one client: kept out of search even though the token is
// what actually guards it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Request new work",
};

/**
 * A repeat client's link for asking for new work. What they send becomes an
 * inbound deal on their account with the brief and files attached.
 */
export default async function RequestPage({ params }: { params: { token: string } }) {
  const link = await requestLinkByToken(params.token);
  const view = link ? await loadRequestPage(link) : null;
  if (!view) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link is invalid or was turned off. Please ask the studio for a new one.
        </p>
      </div>
    );
  }
  return (
    <RequestPageView studioName={view.studioName} logoUrl={view.logoUrl} clientName={view.clientName}>
      <RequestForm
        token={params.token}
        studioName={view.studioName}
        todayIso={new Date().toISOString().slice(0, 10)}
        submit={submitJobRequest}
        finish={finishJobRequest}
      />
    </RequestPageView>
  );
}
