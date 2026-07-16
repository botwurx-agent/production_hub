import type { Metadata } from "next";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { loadBillingDocByToken } from "@/lib/billing-links";
import { BillingDocument } from "@/components/production/billing-document";
import { BillingAcceptForm } from "@/components/production/billing-accept-form";
import { recordDocView } from "@/app/p/[token]/actions";
import { longDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Review & sign",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function PublicDocPage({
  params,
}: {
  params: { token: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Unavailable</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link can&apos;t be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const service = createServiceClient();
  const data = await loadBillingDocByToken(service, params.token);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">
          Link not available
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          This link is invalid or was turned off. Please ask the studio for a new
          one.
        </p>
      </Centered>
    );
  }

  await recordDocView(params.token);

  const { doc, snapshot, logoUrl, attachments } = data;
  const accepted = Boolean(doc.accepted_at);
  const fromName = snapshot.from.businessName || "the studio";
  const isProposal = snapshot.kind === "proposal";

  const signature = accepted
    ? {
        signerName: doc.signer_name,
        signatureKind: doc.signature_kind,
        signatureData: doc.signature_data,
        acceptedAt: doc.accepted_at,
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          {fromName}
        </p>
        <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-text">
          {accepted
            ? `${snapshot.docLabel} accepted`
            : `Review your ${snapshot.docLabel.toLowerCase()}`}
        </h1>
        {accepted ? (
          <p className="mt-1 text-sm text-text-muted">
            Signed by {doc.signer_name}
            {doc.accepted_at ? ` on ${longDate(doc.accepted_at)}` : ""}. A copy is
            below.
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            Please review the details below
            {isProposal ? " and sign to accept." : "."}
          </p>
        )}
      </div>

      <BillingDocument
        doc={snapshot}
        logoUrl={logoUrl}
        signature={signature}
        attachments={attachments}
      />

      {!accepted && isProposal && (
        <BillingAcceptForm
          token={params.token}
          defaultName={snapshot.billTo.name}
          docLabel={snapshot.docLabel}
        />
      )}

      <p className="mt-8 text-center text-xs text-text-faint">
        Shared securely by {fromName}
      </p>
    </div>
  );
}
