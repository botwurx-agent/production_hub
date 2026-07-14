import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { LeadsIcon } from "@/components/app-shell/nav-icons";
import { DealDetail } from "@/components/deals/deal-detail";

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

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, role, email")
    .eq("client_id", account.id)
    .order("created_at", { ascending: true });

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
      <DealDetail deal={deal} account={account} contacts={contacts ?? []} />
    </div>
  );
}
