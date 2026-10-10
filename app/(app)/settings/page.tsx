import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { googleConfigured } from "@/lib/google";
import { slackConfigured } from "@/lib/slack";
import { figmaConfigured } from "@/lib/figma";
import { PageHeader } from "@/components/page-header";
import { SettingsIcon } from "@/components/app-shell/nav-icons";
import { Card } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { Appearance } from "@/components/settings/appearance";
import { Connections } from "@/components/settings/connections";
import {
  BillConnection,
  type BillConnectionView,
} from "@/components/settings/bill-connection";
import { BILL_PUBLIC_COLUMNS, billConfigured, billEnv } from "@/lib/bill";
import { LogoUpload } from "@/components/settings/logo-upload";
import { StudioName } from "@/components/settings/studio-name";
import { BillingProfileForm } from "@/components/settings/billing-profile";
import { TeamPanel } from "@/components/settings/team-panel";
import { AiConnector, type ConnectorLinkRow } from "@/components/settings/ai-connector";
import { canUseConnector } from "@/lib/agent/access";
import type { BillingProfile } from "@/lib/database.types";
import { signedLogoUrl } from "@/lib/branding";
import type { Hue } from "@/components/status-tag";

const roleHue: Record<string, Hue> = {
  owner: "indigo",
  admin: "purple",
  member: "blue",
};

const connectionError: Record<string, string> = {
  google_not_configured: "Gmail is not configured yet (missing credentials).",
  google_denied: "Google connection was cancelled.",
  google_state: "Connection could not be verified. Please try again.",
  google_exchange: "Could not complete the Google connection. Please retry.",
  google_email: "Could not read the Google account email.",
  google_store: "Connected, but saving the account failed. Please retry.",
  slack_not_configured: "Slack is not configured yet (missing credentials).",
  slack_denied: "Slack connection was cancelled.",
  slack_state: "Connection could not be verified. Please try again.",
  slack_exchange: "Could not complete the Slack connection. Please retry.",
  slack_store: "Connected, but saving the account failed. Please retry.",
  figma_not_configured: "Figma is not configured yet (missing credentials).",
  figma_denied: "Figma connection was cancelled.",
  figma_state: "Connection could not be verified. Please try again.",
  figma_exchange: "Could not complete the Figma connection. Please retry.",
  figma_store: "Connected, but saving the account failed. Please retry.",
  no_studio: "No studio found for your account.",
};

const connectedLabel: Record<string, string> = {
  slack: "Slack",
  figma: "Figma",
  google: "Gmail",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [{ data: members }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("id, role, user_id")
        .eq("studio_id", ctx.studio.id)
        .order("created_at"),
      supabase
        .from("email_accounts")
        .select("id, provider, email")
        .order("created_at"),
    ]);

  // Only ever the public columns: an encrypted password has no reason to
  // travel to a page, and a select list is the cheapest way to keep it that
  // way as read sites multiply.
  const { data: billRow } = await supabase
    .from("bill_connections")
    .select(BILL_PUBLIC_COLUMNS)
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();
  // Only this person's own links: a link reads as its maker, so it is theirs
  // to see and turn off (RLS is user_id = auth.uid() as well).
  const { data: connectorRows } = canUseConnector(ctx)
    ? await supabase
        .from("connector_tokens")
        .select("id, name, token_last4, created_at, last_used_at")
        .eq("studio_id", ctx.studio.id)
        .eq("user_id", ctx.userId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };
  const connectorLinks: ConnectorLinkRow[] = (connectorRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    last4: r.token_last4,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));

  const billConnection: BillConnectionView | null = billRow
    ? {
        username: billRow.username,
        orgName: billRow.org_name,
        mfaTrustedAt: billRow.mfa_trusted_at,
      }
    : null;

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();

  const { data: invites } = await supabase
    .from("studio_invites")
    .select("id, email, role, token, accepted_at, accepted_by, revoked, created_at")
    .eq("studio_id", ctx.studio.id)
    .order("created_at", { ascending: false });

  // Resolve who each accepted member is by the invite they accepted; the owner
  // (bootstrap, no invite) resolves to the signed-in email for self.
  const emailByUser = new Map<string, string>();
  for (const inv of invites ?? [])
    if (inv.accepted_by) emailByUser.set(inv.accepted_by, inv.email);

  const memberRows = (members ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    email:
      m.user_id === ctx.userId
        ? (ctx.email ?? "You")
        : (emailByUser.get(m.user_id) ?? null),
    isSelf: m.user_id === ctx.userId,
  }));
  const pendingInvites = (invites ?? [])
    .filter((i) => !i.revoked && !i.accepted_at)
    .map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token }));
  const canManageTeam = ctx.role === "owner" || ctx.role === "admin";

  const errorMsg = searchParams.error
    ? (connectionError[searchParams.error] ?? "Something went wrong.")
    : null;

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Your studio and workspace."
        icon={<SettingsIcon className="h-6 w-6" />}
        hue="indigo"
      />

      {searchParams.connected && (
        <div className="mb-6 rounded-[12px] bg-green-bg px-4 py-3 text-sm font-medium text-green">
          {connectedLabel[searchParams.connected] ?? "Account"} connected.
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 rounded-[12px] bg-red-bg px-4 py-3 text-sm font-medium text-red">
          {errorMsg}
        </div>
      )}

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Studio</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StudioName name={ctx.studio.name} canEdit={canManageTeam} />
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
          <TeamPanel
            members={memberRows}
            pending={pendingInvites}
            canManage={canManageTeam}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Branding</h2>
          <LogoUpload logoUrl={logoUrl} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Connections</h2>
          <Connections
            configured={{
              google: googleConfigured(),
              slack: slackConfigured(),
              figma: figmaConfigured(),
            }}
            accounts={accounts ?? []}
          />

          <div className="mt-6 border-t border-border pt-6">
            <BillConnection
              configured={billConfigured()}
              sandbox={billEnv() === "sandbox"}
              connection={billConnection}
              canEdit={ctx.role === "owner" || ctx.role === "admin"}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-bold">AI connector</h2>
          <AiConnector links={connectorLinks} canUse={canUseConnector(ctx)} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Billing profile</h2>
          <BillingProfileForm profile={(billingProfile as BillingProfile | null) ?? null} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Appearance</h2>
          <Appearance />
        </Card>
      </div>
    </div>
  );
}
