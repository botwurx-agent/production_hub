import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { googleConfigured } from "@/lib/google";
import { slackConfigured } from "@/lib/slack";
import { figmaConfigured } from "@/lib/figma";
import { freshbooksConfigured } from "@/lib/freshbooks";
import { PageHeader } from "@/components/page-header";
import { SettingsIcon } from "@/components/app-shell/nav-icons";
import { Card } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { Appearance } from "@/components/settings/appearance";
import { Connections } from "@/components/settings/connections";
import { LogoUpload } from "@/components/settings/logo-upload";
import { BillingProfileForm } from "@/components/settings/billing-profile";
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
  freshbooks_not_configured:
    "FreshBooks is not configured yet (missing credentials).",
  freshbooks_denied: "FreshBooks connection was cancelled.",
  freshbooks_state: "Connection could not be verified. Please try again.",
  freshbooks_exchange: "Could not complete the FreshBooks connection. Please retry.",
  freshbooks_identity: "Could not read your FreshBooks account. Please retry.",
  freshbooks_account: "No FreshBooks business was found on that account.",
  freshbooks_store: "Connected, but saving the account failed. Please retry.",
  no_studio: "No studio found for your account.",
};

const connectedLabel: Record<string, string> = {
  slack: "Slack",
  figma: "Figma",
  google: "Gmail",
  freshbooks: "FreshBooks",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [{ data: members }, { data: accounts }, { data: billingAccount }] =
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
      supabase
        .from("billing_accounts")
        .select("fb_identity_email")
        .eq("studio_id", ctx.studio.id)
        .eq("provider", "freshbooks")
        .maybeSingle(),
    ]);

  const { data: billingProfile } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();

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
              freshbooks: freshbooksConfigured(),
            }}
            accounts={accounts ?? []}
            freshbooks={{
              connectedEmail: billingAccount
                ? (billingAccount.fb_identity_email ?? "")
                : null,
            }}
          />
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
