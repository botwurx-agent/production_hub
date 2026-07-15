import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { DeliveryPanel } from "@/components/production/delivery-panel";
import { InvoicingPanel } from "@/components/production/invoicing-panel";
import type {
  Deliverable,
  ProjectBilling,
  ProjectInvoice,
} from "@/lib/database.types";

type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

export default async function DeliveryPage({
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

  const [{ data: deliverables }, { data: billing }, { data: invoices }, { data: billingAccount }, { data: rosterContacts }] =
    await Promise.all([
      supabase
        .from("deliverables")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("project_billing")
        .select("*")
        .eq("project_id", params.id)
        .maybeSingle(),
      supabase
        .from("project_invoices")
        .select("*")
        .eq("project_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("billing_accounts")
        .select("id")
        .eq("studio_id", ctx.studio.id)
        .eq("provider", "freshbooks")
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("id, name, email, company")
        .eq("project_id", params.id)
        .order("name"),
    ]);

  // Recipients: the project's own contacts plus the linked client's contacts.
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

  const deliverableList = (deliverables ?? []) as Deliverable[];

  // Billing/invoicing is on hold pending the FreshBooks-vs-Melio decision (see
  // CLAUDE.md). Both entry points are hidden for beta; the DB tables and panels
  // stay wired so this flips back on with one line once the platform is picked.
  const BILLING_ENABLED = false;

  return (
    <div className="space-y-6">
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Delivery & billing"
        hue="green"
        subtitle="Final deliverables, invoices, and billing status."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        }
      />

      {BILLING_ENABLED && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-bold text-text">
              Build an invoice or estimate in the app
            </p>
            <p className="text-xs text-text-muted">
              A branded, editable invoice/estimate with per-line tax, notes, and
              terms. No FreshBooks required.
            </p>
          </div>
          <a
            href={`/projects/${project.id}/invoices`}
            className="inline-flex items-center gap-2 rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            Open invoice generator
          </a>
        </Card>
      )}

      {BILLING_ENABLED && (
        <Card className="p-5">
          <InvoicingPanel
            projectId={project.id}
            invoices={(invoices ?? []) as ProjectInvoice[]}
            freshbooksConnected={Boolean(billingAccount)}
            contacts={contacts}
            deliverables={deliverableList.map((d) => ({
              name: d.name,
              rate: d.rate,
              qty: d.qty,
            }))}
          />
        </Card>
      )}

      <Card className="p-5">
        <DeliveryPanel
          projectId={project.id}
          deliverables={deliverableList}
          billing={(billing as ProjectBilling | null) ?? null}
        />
      </Card>
    </div>
  );
}
