// FreshBooks API client (Phase 6/8 billing connector).
//
// Pure API layer: OAuth2 + the accounting calls we need. No database access
// here; token load/refresh/persist lives in billing-actions.ts (mirrors how the
// Google/Figma connectors keep fetch separate from token storage).
//
// Verified endpoints (FreshBooks "new" API, OAuth2):
//   authorize  https://auth.freshbooks.com/oauth/authorize
//   token      https://api.freshbooks.com/auth/oauth/token
//   me         https://api.freshbooks.com/auth/api/v1/users/me
//   accounting https://api.freshbooks.com/accounting/account/<accountId>/...
// Access tokens live ~12h; refresh with the refresh_token grant.

const AUTH_BASE = "https://auth.freshbooks.com";
const API_BASE = "https://api.freshbooks.com";

export const FRESHBOOKS_REDIRECT_PATH = "/auth/freshbooks/callback";

export type FreshbooksTokens = {
  access_token: string;
  refresh_token: string;
  // seconds until the access token expires (typically ~43200 = 12h)
  expires_in: number;
  created_at?: number;
};

function clientId() {
  const id = process.env.FRESHBOOKS_CLIENT_ID;
  if (!id) throw new Error("FRESHBOOKS_CLIENT_ID is not set");
  return id;
}
function clientSecret() {
  const s = process.env.FRESHBOOKS_CLIENT_SECRET;
  if (!s) throw new Error("FRESHBOOKS_CLIENT_SECRET is not set");
  return s;
}

export function freshbooksConfigured(): boolean {
  return Boolean(
    process.env.FRESHBOOKS_CLIENT_ID && process.env.FRESHBOOKS_CLIENT_SECRET,
  );
}

// The scopes we request. FreshBooks may grant broad access if granular scopes
// are not enabled on the app; that is fine.
const SCOPES = [
  "user:profile:read",
  "user:clients:read",
  "user:clients:write",
  "user:invoices:read",
  "user:invoices:write",
  "user:payments:read",
  "user:payments:write",
  // Paying vendors through FreshBooks Bill Pay: we create the vendor and the
  // bill, read its paid status back, and need the expense categories because
  // every bill line must carry one.
  "user:bills:read",
  "user:bills:write",
  "user:bill_vendors:read",
  "user:bill_vendors:write",
  "user:expenses:read",
];

/** Stored on billing_accounts.scope at connect time, so the app can tell a
 * connection made before bills existed and ask for a reconnect up front
 * rather than letting the first send fail. */
export const FRESHBOOKS_SCOPE = SCOPES.join(" ");

export function hasBillScopes(scope: string | null | undefined): boolean {
  if (!scope) return false;
  const granted = new Set(scope.split(/\s+/));
  return ["user:bills:write", "user:bill_vendors:write", "user:expenses:read"].every(
    (s) => granted.has(s),
  );
}

export function authorizeUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: FRESHBOOKS_SCOPE,
    state,
  });
  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<FreshbooksTokens> {
  const res = await fetch(`${API_BASE}/auth/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FreshBooks token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as FreshbooksTokens;
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest({
    grant_type: "refresh_token",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
}

/** A FreshBooks refusal with its HTTP status, so a caller can tell "this
 * connection lacks the scope" (401/403) from anything else. */
export class FreshbooksError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Api-Version": "alpha",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FreshbooksError(
      `FreshBooks GET ${path} failed (${res.status}): ${text}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

async function apiSend<T>(
  method: "POST" | "PUT",
  path: string,
  token: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FreshbooksError(
      `FreshBooks ${method} ${path} failed (${res.status}): ${text}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

// --- Identity: resolve the account + business id at connect time. -----------

type MeResponse = {
  response?: {
    business_memberships?: Array<{
      business?: {
        id?: number;
        name?: string;
        account_id?: string;
      };
    }>;
  };
  // Some payloads nest identity fields at the top; keep it loose.
  email?: string;
};

export async function getIdentity(token: string) {
  const me = await apiGet<MeResponse>("/auth/api/v1/users/me", token);
  const membership = me.response?.business_memberships?.[0]?.business;
  return {
    accountId: membership?.account_id ?? null,
    businessId: membership?.id != null ? String(membership.id) : null,
    businessName: membership?.name ?? null,
    email: me.email ?? null,
  };
}

// --- Clients ----------------------------------------------------------------

export type FbClientInput = {
  organization?: string;
  fname?: string;
  lname?: string;
  email?: string;
};

type ClientResponse = { response?: { result?: { client?: { id?: number; userid?: number } } } };

export async function createClient(
  accountId: string,
  token: string,
  input: FbClientInput,
): Promise<string> {
  const data = await apiSend<ClientResponse>(
    "POST",
    `/accounting/account/${accountId}/users/clients`,
    token,
    { client: input },
  );
  const c = data.response?.result?.client;
  const id = c?.id ?? c?.userid;
  if (id == null) throw new Error("FreshBooks createClient: no client id returned");
  return String(id);
}

// --- Documents: invoices + estimates ---------------------------------------
// The two share the same shape; only the URL segment, body key, and id/number
// fields differ, so one set of functions handles both.

export type DocKind = "invoice" | "estimate";

export type FbLine = {
  name: string;
  description?: string;
  qty: number;
  unitCost: number; // unit price
};

export type CreateDocInput = {
  clientId: string; // FreshBooks customerid
  createDate: string; // YYYY-MM-DD
  currencyCode?: string; // default USD
  poNumber?: string;
  notes?: string;
  lines: FbLine[];
};

type DocResult = {
  id?: number;
  invoiceid?: number;
  estimateid?: number;
  invoice_number?: string;
  estimate_number?: string;
  amount?: { amount?: string; code?: string };
  outstanding?: { amount?: string; code?: string };
  v3_status?: string;
};
type DocResponse = { response?: { result?: Record<string, DocResult | undefined> } };

function docSegment(kind: DocKind) {
  return kind === "estimate" ? "estimates/estimates" : "invoices/invoices";
}
function docBodyKey(kind: DocKind) {
  return kind === "estimate" ? "estimate" : "invoice";
}

function mapDoc(d: DocResult | undefined) {
  const id = d?.id ?? d?.invoiceid ?? d?.estimateid;
  return {
    fbDocId: id != null ? String(id) : null,
    number: d?.invoice_number ?? d?.estimate_number ?? null,
    amount: d?.amount?.amount != null ? Number(d.amount.amount) : null,
    outstanding:
      d?.outstanding?.amount != null ? Number(d.outstanding.amount) : null,
    currency: d?.amount?.code ?? "USD",
    status: d?.v3_status ?? null,
  };
}

// The FreshBooks web app URL for a document (operator-facing; they view it while
// logged into FreshBooks). Good enough for an in-app "View" link.
export function documentViewUrl(kind: DocKind, accountId: string, docId: string) {
  return `https://my.freshbooks.com/#/${kind}/${accountId}-${docId}`;
}

export async function createDocument(
  kind: DocKind,
  accountId: string,
  token: string,
  input: CreateDocInput,
) {
  const lines = input.lines.map((l) => ({
    type: 0,
    name: l.name,
    description: l.description ?? "",
    qty: String(l.qty),
    unit_cost: {
      amount: l.unitCost.toFixed(2),
      code: input.currencyCode ?? "USD",
    },
  }));
  const data = await apiSend<DocResponse>(
    "POST",
    `/accounting/account/${accountId}/${docSegment(kind)}`,
    token,
    {
      [docBodyKey(kind)]: {
        customerid: Number(input.clientId),
        create_date: input.createDate,
        currency_code: input.currencyCode ?? "USD",
        po_number: input.poNumber ?? undefined,
        notes: input.notes ?? undefined,
        lines,
      },
    },
  );
  return mapDoc(data.response?.result?.[docBodyKey(kind)]);
}

// Email the document to the recipient (also moves it out of draft to "sent").
export async function sendDocument(
  kind: DocKind,
  accountId: string,
  token: string,
  docId: string,
  recipients?: string[],
) {
  const data = await apiSend<DocResponse>(
    "PUT",
    `/accounting/account/${accountId}/${docSegment(kind)}/${docId}`,
    token,
    {
      [docBodyKey(kind)]: {
        action_email: true,
        ...(recipients && recipients.length
          ? { email_recipients: recipients }
          : {}),
      },
    },
  );
  return mapDoc(data.response?.result?.[docBodyKey(kind)]);
}

export async function getDocument(
  kind: DocKind,
  accountId: string,
  token: string,
  docId: string,
) {
  const data = await apiGet<DocResponse>(
    `/accounting/account/${accountId}/${docSegment(kind)}/${docId}`,
    token,
  );
  return mapDoc(data.response?.result?.[docBodyKey(kind)]);
}

// --- Bills (accounts payable) ----------------------------------------------
// A bill is money the studio OWES a vendor. FreshBooks Bill Pay pays it from
// their own screen: the API can create a bill and read its status, and can
// only RECORD a payment, never initiate one. So the send is ours and the pay
// click is theirs.
//
// Shapes below come from FreshBooks' public API reference (Bills GA, Bill
// Vendors beta, Expense Categories), read through search results because the
// docs host is unreachable from the build environment. Parsing is deliberately
// tolerant, and the first live send is the real verification.

export type FbCategory = { id: string; name: string };

type CategoriesResponse = {
  response?: {
    result?: {
      categories?: Array<{
        id?: number;
        categoryid?: number;
        category?: string;
        vis_state?: number;
        parentid?: number | null;
      }>;
      pages?: number;
    };
  };
};

/** Active expense categories, alphabetical. Every bill line needs one. */
export async function listExpenseCategories(
  accountId: string,
  token: string,
): Promise<FbCategory[]> {
  const out: FbCategory[] = [];
  for (let page = 1; page <= 5; page++) {
    const data = await apiGet<CategoriesResponse>(
      `/accounting/account/${accountId}/expenses/categories?per_page=100&page=${page}`,
      token,
    );
    const rows = data.response?.result?.categories ?? [];
    for (const c of rows) {
      const id = c.categoryid ?? c.id;
      if (id == null || !c.category || c.vis_state === 1) continue;
      out.push({ id: String(id), name: c.category });
    }
    const pages = data.response?.result?.pages ?? 1;
    if (page >= pages || rows.length === 0) break;
  }
  const seen = new Set<string>();
  return out
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type VendorRow = { vendorid?: number; id?: number; vendor_name?: string; vis_state?: number };
type VendorsResponse = {
  response?: {
    result?: {
      bill_vendors?: VendorRow[];
      bill_vendor?: VendorRow;
      pages?: number;
    };
  };
};

function vendorKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The vendor with this name, or a new one. Matched on a normalised name so
 * "Jane Doe Lighting, LLC" and "jane doe lighting llc" are one vendor rather
 * than a duplicate every time a bill is sent.
 */
export async function findOrCreateVendor(
  accountId: string,
  token: string,
  name: string,
  currency = "USD",
): Promise<{ vendorId: string; created: boolean }> {
  const want = vendorKey(name);
  for (let page = 1; page <= 10; page++) {
    const data = await apiGet<VendorsResponse>(
      `/accounting/account/${accountId}/bill_vendors/bill_vendors?per_page=100&page=${page}`,
      token,
    );
    const rows = data.response?.result?.bill_vendors ?? [];
    const hit = rows.find(
      (v) => v.vis_state !== 1 && v.vendor_name && vendorKey(v.vendor_name) === want,
    );
    const id = hit?.vendorid ?? hit?.id;
    if (id != null) return { vendorId: String(id), created: false };
    const pages = data.response?.result?.pages ?? 1;
    if (page >= pages || rows.length === 0) break;
  }
  const created = await apiSend<VendorsResponse>(
    "POST",
    `/accounting/account/${accountId}/bill_vendors/bill_vendors`,
    token,
    { bill_vendor: { vendor_name: name, currency_code: currency, language: "en" } },
  );
  const v = created.response?.result?.bill_vendor;
  const id = v?.vendorid ?? v?.id;
  if (id == null) throw new Error("FreshBooks created the vendor but returned no id");
  return { vendorId: String(id), created: true };
}

export type CreateBillInput = {
  vendorId: string;
  categoryId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  billNumber: string | null;
  description: string;
  amount: number;
  currencyCode?: string;
};

type BillRow = {
  id?: number;
  status?: string;
  amount?: { amount?: string; code?: string };
  outstanding?: { amount?: string; code?: string };
  bill_number?: string | null;
};
type BillResponse = { response?: { result?: { bill?: BillRow } } };

export type FbBill = {
  billId: string;
  status: string | null;
  amount: number | null;
  outstanding: number | null;
};

function mapBill(b: BillRow | undefined): FbBill {
  if (b?.id == null) throw new Error("FreshBooks returned no bill");
  const num = (v?: string) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    billId: String(b.id),
    status: b.status ? b.status.toLowerCase() : null,
    amount: num(b.amount?.amount),
    outstanding: num(b.outstanding?.amount),
  };
}

/** Whole days from issue to due, which is how FreshBooks states a due date. */
export function dueOffsetDays(issue: string, due: string | null): number | null {
  if (!due) return null;
  const a = Date.parse(`${issue}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export async function createBill(
  accountId: string,
  token: string,
  input: CreateBillInput,
): Promise<FbBill> {
  const code = input.currencyCode ?? "USD";
  const offset = dueOffsetDays(input.issueDate, input.dueDate);
  const data = await apiSend<BillResponse>(
    "POST",
    `/accounting/account/${accountId}/bills/bills`,
    token,
    {
      bill: {
        vendorid: Number(input.vendorId),
        bill_number: input.billNumber || null,
        issue_date: input.issueDate,
        ...(offset !== null ? { due_offset_days: offset } : {}),
        currency_code: code,
        language: "en",
        lines: [
          {
            categoryid: Number(input.categoryId),
            quantity: 1,
            unit_cost: { amount: input.amount.toFixed(2), code },
            description: input.description.slice(0, 500),
          },
        ],
      },
    },
  );
  return mapBill(data.response?.result?.bill);
}

export async function getBill(
  accountId: string,
  token: string,
  billId: string,
): Promise<FbBill> {
  const data = await apiGet<BillResponse>(
    `/accounting/account/${accountId}/bills/bills/${billId}`,
    token,
  );
  return mapBill(data.response?.result?.bill);
}

/**
 * Where the producer goes to pay. The bills list rather than a deep link to
 * the one bill, because the web app's per-bill URL is not documented and a
 * guessed one that 404s is worse than a list with the bill at the top.
 * Tighten this once the first live bill shows the real address.
 */
export const FRESHBOOKS_BILLS_URL = "https://my.freshbooks.com/#/bills";

/** Paid by FreshBooks' own word, or by nothing left outstanding on a bill
 * that had something to pay. Either is enough to stop chasing it here. */
export function billIsPaid(bill: Pick<FbBill, "status" | "amount" | "outstanding">): boolean {
  if (bill.status === "paid") return true;
  return bill.outstanding === 0 && (bill.amount ?? 0) > 0;
}
