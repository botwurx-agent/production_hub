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
];

export function authorizeUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
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
    throw new Error(`FreshBooks GET ${path} failed (${res.status}): ${text}`);
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
    throw new Error(`FreshBooks ${method} ${path} failed (${res.status}): ${text}`);
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
