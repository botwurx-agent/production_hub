import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { signedLogoUrl } from "@/lib/branding";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { BillingDocument } from "@/components/production/billing-document";
import { buildDocSnapshot } from "@/lib/billing-doc";
import type {
  BillingDocument as BillingDocumentRow,
  BillingDocumentLine,
  BillingDocumentAttachment,
  BillingProfile,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: { id: string; docId: string };
  searchParams?: { auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: docRow } = await supabase
    .from("billing_documents")
    .select(
      "*, lines:billing_document_lines(*), attachments:billing_document_attachments(*)"
    )
    .eq("id", params.docId)
    .eq("project_id", params.id)
    .maybeSingle();
  if (!docRow) notFound();

  const doc = docRow as unknown as BillingDocumentRow & {
    lines: BillingDocumentLine[];
    attachments: BillingDocumentAttachment[];
  };

  const { data: profile } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();

  const snapshot = buildDocSnapshot({
    doc,
    lines: doc.lines ?? [],
    profile: (profile as BillingProfile | null) ?? null,
    attachments: (doc.attachments ?? []).map((a) => ({
      name: a.name,
      storagePath: a.storage_path,
    })),
  });

  // Sign attachment links so they open from the on-screen print view too.
  const attachments: { name: string; url: string }[] = [];
  for (const a of doc.attachments ?? []) {
    const { data: signed } = await supabase.storage
      .from("assets")
      .createSignedUrl(a.storage_path, 60 * 60);
    if (signed?.signedUrl) attachments.push({ name: a.name, url: signed.signedUrl });
  }

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  return (
    <div className="mx-auto max-w-3xl">
      {searchParams?.auto ? <AutoPrint /> : null}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/invoices`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to documents
        </Link>
        <PrintButton />
      </div>

      {/* Force a clean light document regardless of the app theme, and keep
          backgrounds (accent bands) in the printed PDF. */}
      <div
        data-theme="light"
        style={{
          colorScheme: "light",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <BillingDocument doc={snapshot} logoUrl={logoUrl} attachments={attachments} />
      </div>
    </div>
  );
}
