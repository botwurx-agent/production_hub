import type { Metadata } from "next";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import {
  getCallSheetRecipient,
  loadCallSheetForRecipient,
} from "@/lib/callsheet-links";
import { CallSheetDocument } from "@/components/production/callsheet-document";
import { recordCallSheetView } from "@/app/c/[token]/actions";
import { ConfirmBar } from "@/app/c/[token]/confirm-bar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Call sheet",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function PublicCallSheetPage({
  params,
}: {
  params: { token: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Call sheet unavailable</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link can&apos;t be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const service = createServiceClient();
  const recipient = await getCallSheetRecipient(service, params.token);
  if (!recipient) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This call sheet link is invalid or was turned off. Please ask the studio
          for a new one.
        </p>
      </Centered>
    );
  }

  // Record the open (first time only).
  await recordCallSheetView(params.token);

  const data = await loadCallSheetForRecipient(service, recipient);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Nothing to show</h1>
        <p className="mt-2 text-sm text-text-muted">
          This call sheet is no longer available.
        </p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          {data.studioName}
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-text">
          You&apos;re on the call sheet
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Hi {recipient.name} — please review the details below and confirm you can
          make it.
        </p>
      </div>

      <ConfirmBar
        token={params.token}
        confirmed={Boolean(recipient.confirmed_at)}
      />

      <div className="mt-4">
        <CallSheetDocument
          sheet={data.sheet}
          entries={data.entries}
          logoUrl={data.logoUrl}
          studioName={data.studioName}
          clientName={data.clientName}
        />
      </div>

      <p className="mt-8 text-center text-xs text-text-faint">
        Shared securely by {data.studioName}
      </p>
    </div>
  );
}
