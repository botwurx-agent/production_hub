import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshTokens } from "@/lib/freshbooks";
import type { BillingAccount, Database } from "@/lib/database.types";

// Server-side FreshBooks connection helpers. Kept separate from lib/freshbooks.ts
// (pure API) so both a server action (RLS client) and the webhook (service-role
// client) can load + refresh tokens through the same path.

type DB = SupabaseClient<Database>;

export async function getBillingAccount(
  supabase: DB,
  studioId: string,
): Promise<BillingAccount | null> {
  const { data } = await supabase
    .from("billing_accounts")
    .select("*")
    .eq("studio_id", studioId)
    .eq("provider", "freshbooks")
    .maybeSingle();
  return data ?? null;
}

export type FreshbooksAuth = { token: string; accountId: string };

// Returns a valid access token + accounting account id, refreshing and
// persisting the token when it is within 5 minutes of expiry.
export async function getFreshbooksAuth(
  supabase: DB,
  account: BillingAccount,
): Promise<FreshbooksAuth> {
  if (!account.refresh_token || !account.fb_account_id) {
    throw new Error("FreshBooks is not fully connected");
  }
  const expMs = account.token_expiry
    ? new Date(account.token_expiry).getTime()
    : 0;
  const stale = Date.now() > expMs - 5 * 60 * 1000;

  if (!account.access_token || stale) {
    const t = await refreshTokens(account.refresh_token);
    const expiry = new Date(Date.now() + t.expires_in * 1000).toISOString();
    await supabase
      .from("billing_accounts")
      .update({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        token_expiry: expiry,
      })
      .eq("id", account.id);
    return { token: t.access_token, accountId: account.fb_account_id };
  }
  return { token: account.access_token, accountId: account.fb_account_id };
}

// Maps a FreshBooks v3_status string onto our project_invoices.status vocabulary.
export function mapInvoiceStatus(v3?: string | null): string {
  switch ((v3 ?? "").toLowerCase()) {
    case "paid":
      return "paid";
    case "partial":
      return "partial";
    case "sent":
      return "sent";
    case "viewed":
      return "viewed";
    case "overdue":
      return "overdue";
    case "disputed":
      return "disputed";
    case "draft":
      return "draft";
    default:
      return v3 ? v3.toLowerCase() : "draft";
  }
}
