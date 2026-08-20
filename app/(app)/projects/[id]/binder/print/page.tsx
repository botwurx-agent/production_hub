import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { BinderDocument } from "@/components/production/binder-document";
import { AutoPrint } from "@/components/production/auto-print";
import { PrintButton } from "@/components/production/print-button";
import { loadBinderPreview } from "@/lib/binder-data";

export const dynamic = "force-dynamic";

/**
 * The studio's own view of a binder, and its PDF.
 *
 * Renders through the SAME component the client's page uses, so what prints is
 * what they were sent. Forced light, like every other print view here: a
 * binder that arrives with a dark background is a binder nobody can print.
 */
export default async function BinderPrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { b?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  if (!searchParams.b) notFound();

  const view = await loadBinderPreview(
    supabase,
    ctx.studio.id,
    params.id,
    searchParams.b
  );
  if (!view) notFound();

  return (
    <div data-theme="light" className="min-h-screen bg-bg print:bg-white">
      <div className="mx-auto max-w-4xl px-5 pt-5 print:hidden">
        <PrintButton />
      </div>
      <BinderDocument view={view} />
      {searchParams.auto === "1" && <AutoPrint />}
    </div>
  );
}
