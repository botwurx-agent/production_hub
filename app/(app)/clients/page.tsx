import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { NewClientButton } from "@/components/clients/new-client-button";
import { ClientsTable, type ClientRow } from "@/components/clients/clients-table";
import { ClientsIcon } from "@/components/app-shell/nav-icons";

export default async function ClientsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, type, account_status, contacts(count), projects(count)")
    .order("name");

  const rows: ClientRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    account_status: c.account_status,
    contactCount: (c.contacts as { count: number }[] | null)?.[0]?.count ?? 0,
    projectCount: (c.projects as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="The brands and agencies you work with, plus prospects in the pipeline."
        icon={<ClientsIcon className="h-6 w-6" />}
        hue="cyan"
        action={<NewClientButton />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="h-7 w-7" />}
          title="No clients yet"
          description="Add a brand or agency, or win a deal in the pipeline to create one."
          action={<NewClientButton />}
        />
      ) : (
        <ClientsTable rows={rows} />
      )}
    </div>
  );
}
