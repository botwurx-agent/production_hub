import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { NewClientButton } from "@/components/clients/new-client-button";
import { ClientsIcon } from "@/components/app-shell/nav-icons";

export default async function ClientsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, type, contacts(count), projects(count)")
    .order("name");

  const rows = clients ?? [];

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="The brands and agencies you work with."
        action={<NewClientButton />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="h-7 w-7" />}
          title="No clients yet"
          description="Add a brand or agency, or convert a lead once it is won."
          action={<NewClientButton />}
        />
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="hidden px-4 py-3 sm:table-cell">Contacts</th>
                <th className="hidden px-4 py-3 sm:table-cell">Projects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const contactCount =
                  (c.contacts as { count: number }[] | null)?.[0]?.count ?? 0;
                const projectCount =
                  (c.projects as { count: number }[] | null)?.[0]?.count ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="font-semibold text-text hover:text-accent"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag hue={c.type === "agency" ? "purple" : "blue"}>
                        {c.type === "agency" ? "Agency" : "Brand"}
                      </StatusTag>
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {contactCount}
                    </td>
                    <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                      {projectCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
