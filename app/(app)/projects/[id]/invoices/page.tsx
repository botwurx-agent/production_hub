import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { signedLogoUrl } from "@/lib/branding";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { InvoiceWorkspace } from "@/components/production/invoice-workspace";
import type {
  BillingDocument,
  BillingDocumentLine,
  BillingProfile,
} from "@/lib/database.types";

type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

export default async function InvoicesPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: docs }, { data: profile }, { data: rosterContacts }] =
    await Promise.all([
      supabase
        .from("billing_documents")
        .select("*, lines:billing_document_lines(*)")
        .eq("project_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("billing_profiles")
        .select("*")
        .eq("studio_id", ctx.studio.id)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("id, name, email, company")
        .eq("project_id", params.id)
        .order("name"),
    ]);

  let clientContacts: ContactOption[] = [];
  if (project.client_id) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, email, company")
      .eq("client_id", project.client_id)
      .order("name");
    clientContacts = (data ?? []) as ContactOption[];
  }
  const contacts: ContactOption[] = [
    ...((rosterContacts ?? []) as ContactOption[]),
    ...clientContacts,
  ];

  const documents = ((docs ?? []) as unknown as (BillingDocument & {
    lines: BillingDocumentLine[];
  })[]).map((d) => ({
    ...d,
    lines: [...(d.lines ?? [])].sort((a, b) => a.position - b.position),
  }));

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Invoices & estimates"
        hue="green"
        subtitle="Create, edit, and track invoices and estimates for this project."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2h9l5 5v15H6z" />
            <path d="M14 2v6h6M9 13h6M9 17h6M9 9h2" />
          </svg>
        }
      />
      <Card className="p-5">
        <InvoiceWorkspace
          projectId={project.id}
          documents={documents}
          profile={(profile as BillingProfile | null) ?? null}
          logoUrl={logoUrl}
          contacts={contacts}
        />
      </Card>
    </div>
  );
}
