import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BinderDocument } from "@/components/production/binder-document";
import { AutoPrint } from "@/components/production/auto-print";
import { PrintButton } from "@/components/production/print-button";
import { loadBinderByToken, recordBinderView } from "@/lib/binder-data";

export const dynamic = "force-dynamic";

// A binder is a private document shared with named people, so it stays out of
// search results even though the token is what actually guards it.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The client's binder.
 *
 * No login. Token only, and the same renderer the studio previews and prints,
 * so there is no second version to drift.
 */
export default async function PublicBinderPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { auto?: string };
}) {
  const view = await loadBinderByToken(params.token);
  if (!view) notFound();

  // Best effort: a failed count must never fail the page a client is reading.
  void recordBinderView(params.token).catch(() => {});

  return (
    <div data-theme="light" className="min-h-screen bg-bg print:bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-end px-5 pt-5 print:hidden">
        <PrintButton />
      </div>
      <BinderDocument view={view} />
      {searchParams.auto === "1" && <AutoPrint />}
    </div>
  );
}
