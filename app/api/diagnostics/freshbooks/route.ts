// Which FreshBooks endpoint is actually closed, and why.
//
// The first real bill was refused with "You do not have access to bill
// vendors" while the expense categories loaded on the same token, and three
// separate explanations fitted that single data point equally well: the plan
// not carrying Accounts Payable, the OAuth app not being configured to request
// the bill scopes, or the request shape being wrong on a beta endpoint. Two of
// those were guessed at in turn and both were wrong, which is the reason this
// exists: one press reads every relevant endpoint side by side and reports
// what each one said, so the next move comes off evidence rather than off a
// pricing page.
//
// Read-only. It creates no vendor and no bill, so it is safe to press at any
// point, including in the middle of a job.
//
// Staff only, same gate as the send path: project_costs and the billing
// connection are both is_studio_member, and a collaborator is refused here as
// well as there.
import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccount, getFreshbooksAuth } from "@/lib/billing";
import { hasBillScopes, probeFreshbooks } from "@/lib/freshbooks";
import { freshbooksReason } from "@/lib/freshbooks-error";

export const dynamic = "force-dynamic";

// Enough of a refusal to read it, not so much that a stack of them is
// unreadable. FreshBooks' own reason is pulled out separately anyway.
const BODY_CHARS = 400;

type Check = {
  what: string;
  path: string;
  apiVersion: boolean;
  status: number;
  ok: boolean;
  reason: string | null;
  body?: string;
};

async function check(
  what: string,
  path: string,
  token: string,
  apiVersion: boolean,
): Promise<Check> {
  const res = await probeFreshbooks(path, token, { apiVersion });
  return {
    what,
    path,
    apiVersion,
    status: res.status,
    ok: res.ok,
    reason: freshbooksReason(res.body),
    // A success body is the data we asked for and says nothing useful here.
    ...(res.ok ? {} : { body: res.body.slice(0, BODY_CHARS) }),
  };
}

export async function GET() {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (ctx.isCollaborator) {
    return NextResponse.json({ error: "Not available on this account." }, { status: 403 });
  }

  const supabase = createClient();
  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) {
    return NextResponse.json({ error: "FreshBooks is not connected." }, { status: 404 });
  }

  let token: string;
  let accountId: string;
  try {
    ({ token, accountId } = await getFreshbooksAuth(supabase, account));
  } catch (e) {
    return NextResponse.json(
      { error: `Could not get a FreshBooks token: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 },
    );
  }

  // The stored scope is a list of permission names on the viewer's own
  // connection, so showing it to them leaks nothing, and it is half the
  // question. The tokens themselves are never in this response.
  const scope = (account.scope ?? "").trim();

  // Identity first: a FreshBooks login can hold several businesses, and
  // calling the right endpoints against the wrong account id would produce
  // exactly the refusal we are chasing.
  const me = await probeFreshbooks("/auth/api/v1/users/me", token);
  let businesses: unknown[] = [];
  if (me.ok) {
    try {
      const parsed = JSON.parse(me.body) as {
        response?: { business_memberships?: unknown[] };
      };
      const rows = parsed.response?.business_memberships ?? [];
      // Only the fields that bear on this. The rest of /me is the operator's
      // own profile and has no business being echoed back out of a diagnostic.
      businesses = rows.map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        const biz = (row.business ?? {}) as Record<string, unknown>;
        return {
          role: row.role ?? null,
          businessId: biz.id ?? null,
          accountId: biz.account_id ?? null,
          name: biz.name ?? null,
        };
      });
    } catch {
      businesses = [];
    }
  }

  const base = `/accounting/account/${accountId}`;
  const checks: Check[] = [];
  // The control goes first: this one is known to work, so if it ever fails the
  // whole reading changes and nothing below it is worth interpreting.
  checks.push(await check("expense categories (control)", `${base}/expenses/categories?per_page=1`, token, true));
  // Vendors and bills are asked SEPARATELY because the answer turns on
  // whether both are shut or only the newer one is.
  checks.push(await check("bill vendors", `${base}/bill_vendors/bill_vendors?per_page=1`, token, true));
  checks.push(await check("bills", `${base}/bills/bills?per_page=1`, token, true));
  // And both again without the alpha version header, since that header is a
  // variable we have never tested rather than a thing we know is right.
  checks.push(await check("bill vendors, no Api-Version", `${base}/bill_vendors/bill_vendors?per_page=1`, token, false));
  checks.push(await check("bills, no Api-Version", `${base}/bills/bills?per_page=1`, token, false));

  const vendors = checks.find((c) => c.what === "bill vendors");
  const bills = checks.find((c) => c.what === "bills");
  const control = checks.find((c) => c.what.startsWith("expense categories"));

  // Stated as a reading of the rows above, never as a conclusion to act on
  // without them: the whole point of this route is that the evidence travels
  // with the summary.
  let reading: string;
  if (!control?.ok) {
    reading = "The control call failed too, so this is not about bills at all. The connection itself is not working.";
  } else if (bills?.ok && !vendors?.ok) {
    reading = "Bills are allowed and only bill vendors are refused, so Accounts Payable is open and the beta vendor endpoint is the thing that is closed. The send could be reworked to take a vendor id instead of looking one up.";
  } else if (!bills?.ok && !vendors?.ok) {
    reading = "Both bills and bill vendors are refused while the control call works, so the token is good and the whole Accounts Payable API is closed to it. That is either the scopes on the OAuth app or an account permission, and the stored scope above says which to check first.";
  } else if (bills?.ok && vendors?.ok) {
    reading = "Both are allowed on this token. Whatever refused the send is not a standing permission, so re-run the send and read the error it gives now.";
  } else {
    reading = "Bill vendors are allowed and bills are not, which is the reverse of what was seen. Read the rows.";
  }

  return NextResponse.json({
    studio: ctx.studio.name,
    accountId,
    scope,
    scopeLooksSufficient: hasBillScopes(scope),
    businesses,
    checks,
    reading,
  });
}
