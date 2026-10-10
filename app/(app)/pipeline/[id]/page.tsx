import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { LeadsIcon } from "@/components/app-shell/nav-icons";
import { DealDetail } from "@/components/deals/deal-detail";
import { RequestCard } from "@/components/requests/request-card";
import { parseRequestFiles } from "@/lib/job-request";

export default async function DealDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: account } = await supabase
    .from("clients")
    .select("id, name, account_status")
    .eq("id", deal.account_id)
    .maybeSingle();
  if (!account) notFound();

  const [{ data: contacts }, { data: activities }, { data: tasks }, { data: request }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, role, email")
        .eq("client_id", account.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("crm_activities")
        .select("id, kind, body, occurred_at")
        .eq("deal_id", deal.id)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("crm_tasks")
        .select("id, title, due_date, done")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_requests")
        .select("id, title, details, needed_by, budget, contact_name, contact_email, files, created_at")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return (
    <div>
      <PageHeader
        title={deal.title}
        subtitle="Deal"
        icon={<LeadsIcon className="h-6 w-6" />}
        hue="pink"
        action={
          <Link
            href="/pipeline"
            className="text-sm font-semibold text-accent hover:underline"
          >
            &larr; Pipeline
          </Link>
        }
      />
      {request && (
        <RequestCard
          request={{
            id: request.id,
            title: request.title,
            details: request.details,
            neededBy: request.needed_by,
            // numeric comes back from PostgREST as a string.
            budget: request.budget == null ? null : Number(request.budget),
            contactName: request.contact_name,
            contactEmail: request.contact_email,
            files: parseRequestFiles(request.files),
            createdAt: request.created_at,
          }}
        />
      )}
      <DealDetail
        deal={deal}
        account={account}
        contacts={contacts ?? []}
        activities={activities ?? []}
        tasks={tasks ?? []}
      />
    </div>
  );
}
