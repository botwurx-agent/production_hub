import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { Appearance } from "@/components/settings/appearance";
import type { Hue } from "@/components/status-tag";

const roleHue: Record<string, Hue> = {
  owner: "indigo",
  admin: "purple",
  member: "blue",
};

export default async function SettingsPage() {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, role, user_id")
    .eq("studio_id", ctx.studio.id)
    .order("created_at");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Your studio and workspace." />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Studio</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-text-faint">Name</dt>
              <dd className="mt-0.5 text-sm font-medium text-text">
                {ctx.studio.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-faint">
                Your role
              </dt>
              <dd className="mt-1">
                <StatusTag hue={roleHue[ctx.role] ?? "blue"}>
                  {ctx.role}
                </StatusTag>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-faint">
                Signed in as
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-text">
                {ctx.email}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-base font-bold">Team</h2>
          <p className="mb-4 text-sm text-text-muted">
            {members?.length ?? 1} member
            {(members?.length ?? 1) === 1 ? "" : "s"} in this studio.
          </p>
          <ul className="space-y-2">
            {(members ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-[11px] border border-border px-3 py-2.5"
              >
                <span className="text-sm font-medium text-text">
                  {m.user_id === ctx.userId ? `${ctx.email} (you)` : "Team member"}
                </span>
                <StatusTag hue={roleHue[m.role] ?? "blue"}>{m.role}</StatusTag>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Appearance</h2>
          <Appearance />
        </Card>
      </div>
    </div>
  );
}
