"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getBillingAccount, getFreshbooksAuth, mapInvoiceStatus } from "@/lib/billing";
import {
  createClient as fbCreateClient,
  createInvoice as fbCreateInvoice,
  sendInvoice as fbSendInvoice,
  getInvoice as fbGetInvoice,
} from "@/lib/freshbooks";

export type BillingActionState = { error?: string; ok?: boolean } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}`);
}

function today(): string {
  // YYYY-MM-DD in UTC; the invoice of record lives in FreshBooks anyway.
  return new Date().toISOString().slice(0, 10);
}

// Resolve (or lazily create) the FreshBooks client for this project's client,
// caching the FreshBooks id on clients.external_ref so we don't duplicate.
async function resolveFbClient(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  token: string,
  projectId: string,
): Promise<{ fbClientId: string } | { error: string }> {
  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.client_id) {
    return { error: "Add a client to this project before invoicing." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, external_ref")
    .eq("id", project.client_id)
    .maybeSingle();
  if (!client) return { error: "Project client not found." };

  const ref = (client.external_ref as Record<string, unknown> | null) ?? null;
  const cached = ref?.["freshbooks_client_id"];
  if (typeof cached === "string" && cached) {
    return { fbClientId: cached };
  }

  // First invoice for this client: create it in FreshBooks from its primary
  // contact email (if any).
  const { data: contact } = await supabase
    .from("contacts")
    .select("name, email")
    .eq("client_id", client.id)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();

  let fbClientId: string;
  try {
    fbClientId = await fbCreateClient(accountId, token, {
      organization: client.name,
      email: contact?.email ?? undefined,
    });
  } catch (e) {
    return { error: `FreshBooks client create failed: ${(e as Error).message}` };
  }

  await supabase
    .from("clients")
    .update({ external_ref: { ...(ref ?? {}), freshbooks_client_id: fbClientId } })
    .eq("id", client.id);

  return { fbClientId };
}

export async function createInvoiceForProject(
  projectId: string,
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Priced deliverables become the invoice line items.
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("name, spec, rate, qty")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  const lines = (deliverables ?? [])
    .filter((d) => d.rate != null && Number(d.rate) > 0)
    .map((d) => ({
      name: d.name || "Deliverable",
      description: d.spec ?? "",
      qty: d.qty ?? 1,
      unitCost: Number(d.rate),
    }));

  if (lines.length === 0) {
    return {
      error: "Set a rate on at least one deliverable to build the invoice.",
    };
  }

  const resolved = await resolveFbClient(supabase, auth.accountId, auth.token, projectId);
  if ("error" in resolved) return { error: resolved.error };

  let inv;
  try {
    inv = await fbCreateInvoice(auth.accountId, auth.token, {
      clientId: resolved.fbClientId,
      createDate: today(),
      lines,
    });
  } catch (e) {
    return { error: `FreshBooks invoice create failed: ${(e as Error).message}` };
  }
  if (!inv.fbInvoiceId) return { error: "FreshBooks did not return an invoice id." };

  const { error } = await supabase.from("project_invoices").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      fb_invoice_id: inv.fbInvoiceId,
      fb_client_id: resolved.fbClientId,
      number: inv.number,
      status: mapInvoiceStatus(inv.status ?? "draft"),
      amount: inv.amount,
      currency: inv.currency,
      created_by: ctx.userId,
    },
    { onConflict: "studio_id,fb_invoice_id" },
  );
  if (error) return { error: error.message };

  // Keep the legacy billing card coherent.
  await supabase.from("project_billing").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      status: "invoiced",
      amount: inv.amount,
      invoice_no: inv.number,
      updated_at: new Date().toISOString(),
      created_by: ctx.userId,
    },
    { onConflict: "project_id" },
  );

  rp(projectId);
  return { ok: true };
}

export async function sendInvoiceForProject(
  projectId: string,
  invoiceRowId: string,
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  const { data: row } = await supabase
    .from("project_invoices")
    .select("fb_invoice_id")
    .eq("id", invoiceRowId)
    .maybeSingle();
  if (!row) return { error: "Invoice not found." };

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let inv;
  try {
    inv = await fbSendInvoice(auth.accountId, auth.token, row.fb_invoice_id);
  } catch (e) {
    return { error: `FreshBooks send failed: ${(e as Error).message}` };
  }

  await supabase
    .from("project_invoices")
    .update({ status: mapInvoiceStatus(inv.status ?? "sent") })
    .eq("id", invoiceRowId);

  rp(projectId);
  return { ok: true };
}

export async function syncInvoiceForProject(
  projectId: string,
  invoiceRowId: string,
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  const { data: row } = await supabase
    .from("project_invoices")
    .select("fb_invoice_id")
    .eq("id", invoiceRowId)
    .maybeSingle();
  if (!row) return { error: "Invoice not found." };

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let inv;
  try {
    inv = await fbGetInvoice(auth.accountId, auth.token, row.fb_invoice_id);
  } catch (e) {
    return { error: `FreshBooks sync failed: ${(e as Error).message}` };
  }

  const status = mapInvoiceStatus(inv.status);
  const amountPaid =
    inv.amount != null && inv.outstanding != null
      ? Math.max(0, inv.amount - inv.outstanding)
      : undefined;

  await supabase
    .from("project_invoices")
    .update({
      status,
      amount: inv.amount ?? undefined,
      ...(amountPaid != null ? { amount_paid: amountPaid } : {}),
    })
    .eq("id", invoiceRowId);

  if (status === "paid") {
    await supabase
      .from("project_billing")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("project_id", projectId);
  }

  rp(projectId);
  return { ok: true };
}
