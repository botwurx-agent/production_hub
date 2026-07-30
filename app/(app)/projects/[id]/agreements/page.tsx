import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import {
  AgreementList,
  type InheritedAgreement,
} from "@/components/agreements/agreement-list";
import { AGREEMENT_KIND, agreementKind } from "@/lib/agreements";
import type { Agreement } from "@/lib/database.types";

export default async function ProjectAgreementsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client_id, client:clients(id, name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const client = project.client as unknown as { id: string; name: string } | null;

  const [{ data: own }, { data: accountLevel }] = await Promise.all([
    supabase
      .from("agreements")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
    // The NDA and master agreement live on the account and govern this SOW, so
    // the project shows they exist without claiming to own them. This is the
    // question that costs you the night before a shoot.
    project.client_id
      ? supabase
          .from("agreements")
          .select("*")
          .eq("client_id", project.client_id)
          .in("kind", ["nda", "msa"])
          .order("effective_date", { ascending: false })
      : Promise.resolve({ data: [] as Agreement[] }),
  ]);

  const inherited: InheritedAgreement[] = ((accountLevel ?? []) as Agreement[]).map(
    (a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      counterparty: a.counterparty,
      effective_date: a.effective_date,
      expires_date: a.expires_date,
      our_signed_at: a.our_signed_at,
      their_signed_at: a.their_signed_at,
      clientId: client?.id ?? "",
      clientName: client?.name ?? "the client",
    })
  );

  // A SOW is usually governed by one of the account's master agreements.
  const parents = ((accountLevel ?? []) as Agreement[]).map((a) => ({
    id: a.id,
    label: `${AGREEMENT_KIND[agreementKind(a.kind)].label}: ${a.title || "Untitled"}`,
  }));

  // Resolved on the SERVER so "expired" cannot differ after hydration.
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Agreements"
        hue="purple"
        subtitle="SOWs, change orders and the paperwork this job runs under."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M9 15h6M9 11h3" />
          </svg>
        }
      />
      <Card className="p-5">
        <AgreementList
          agreements={(own ?? []) as Agreement[]}
          inherited={inherited}
          projectId={project.id}
          todayIso={todayIso}
          defaultCounterparty={client?.name ?? null}
          kinds={["sow", "change_order", "nda", "other"]}
          parents={parents}
        />
      </Card>
    </div>
  );
}
