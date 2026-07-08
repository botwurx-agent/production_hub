"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getBillingAccount, getFreshbooksAuth, mapInvoiceStatus } from "@/lib/billing";
import {
  createClient as fbCreateClient,
  createDocument as fbCreateDocument,
  sendDocument as fbSendDocument,
  getDocument as fbGetDocument,
  documentViewUrl,
  type DocKind,
} from "@/lib/freshbooks";

export type BillingActionState = { error?: string; ok?: boolean } | null;

export type DocRecipient = {
  contactId?: string;
  name?: string;
  email?: string;
  company?: string;
};

export type DocLineInput = { name: string; qty: number; rate: number };

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { fname: parts[0] ?? "", lname: "" };
  return { fname: parts[0], lname: parts.slice(1).join(" ") };
}

// Resolve the recipient into a FreshBooks client id, reusing an existing one for
// the same email (cached on prior documents) so we don't create duplicates.
async function resolveRecipient(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
  accountId: string,
  token: string,
  recipient: DocRecipient,
): Promise<
  | { fbClientId: string; name: string; email: string | null }
  | { error: string }
> {
  let name = recipient.name?.trim() ?? "";
  let email = recipient.email?.trim() ?? "";
  let company = recipient.company?.trim() ?? "";

  if (recipient.contactId) {
    const { data: c } = await supabase
      .from("contacts")
      .select("name, email, company")
      .eq("id", recipient.contactId)
      .maybeSingle();
    if (c) {
      name = c.name ?? name;
      email = c.email ?? email;
      company = c.company ?? company;
    }
  }

  if (!name && !company) {
    return { error: "Pick a recipient or enter a name for the invoice." };
  }

  // Reuse an existing FreshBooks client for this email.
  if (email) {
    const { data: prior } = await supabase
      .from("project_invoices")
      .select("fb_client_id")
      .eq("studio_id", studioId)
      .eq("recipient_email", email)
      .not("fb_client_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (prior?.fb_client_id) {
      return { fbClientId: prior.fb_client_id, name: name || company, email };
    }
  }

  const { fname, lname } = splitName(name);
  let fbClientId: string;
  try {
    fbClientId = await fbCreateClient(accountId, token, {
      organization: company || name,
      fname,
      lname,
      email: email || undefined,
    });
  } catch (e) {
    return { error: `FreshBooks client create failed: ${(e as Error).message}` };
  }
  return { fbClientId, name: name || company, email: email || null };
}

export async function createProjectDocument(
  projectId: string,
  input: { kind: DocKind; recipient: DocRecipient; lines: DocLineInput[] },
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  const lines = (input.lines ?? [])
    .filter((l) => l.name.trim() && Number(l.rate) > 0)
    .map((l) => ({
      name: l.name.trim(),
      qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
      unitCost: Number(l.rate),
    }));
  if (lines.length === 0) {
    return { error: "Add at least one line item with a description and rate." };
  }

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const who = await resolveRecipient(
    supabase,
    ctx.studio.id,
    auth.accountId,
    auth.token,
    input.recipient,
  );
  if ("error" in who) return { error: who.error };

  let doc;
  try {
    doc = await fbCreateDocument(input.kind, auth.accountId, auth.token, {
      clientId: who.fbClientId,
      createDate: today(),
      lines,
    });
  } catch (e) {
    return { error: `FreshBooks ${input.kind} create failed: ${(e as Error).message}` };
  }
  if (!doc.fbDocId) return { error: "FreshBooks did not return a document id." };

  const { error } = await supabase.from("project_invoices").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      kind: input.kind,
      fb_invoice_id: doc.fbDocId,
      fb_client_id: who.fbClientId,
      recipient_name: who.name,
      recipient_email: who.email,
      number: doc.number,
      status: mapInvoiceStatus(doc.status ?? "draft"),
      amount: doc.amount,
      currency: doc.currency,
      hosted_url: documentViewUrl(input.kind, auth.accountId, doc.fbDocId),
      created_by: ctx.userId,
    },
    { onConflict: "studio_id,fb_invoice_id" },
  );
  if (error) return { error: error.message };

  // Reflect a created invoice on the manual billing card.
  if (input.kind === "invoice") {
    await supabase.from("project_billing").upsert(
      {
        studio_id: ctx.studio.id,
        project_id: projectId,
        status: "invoiced",
        amount: doc.amount,
        invoice_no: doc.number,
        updated_at: new Date().toISOString(),
        created_by: ctx.userId,
      },
      { onConflict: "project_id" },
    );
  }

  rp(projectId);
  return { ok: true };
}

export async function sendProjectDocument(
  projectId: string,
  rowId: string,
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  const { data: row } = await supabase
    .from("project_invoices")
    .select("fb_invoice_id, kind, recipient_email")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Document not found." };
  if (!row.recipient_email) {
    return { error: "This recipient has no email, so it can't be sent. Add one and recreate." };
  }

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let doc;
  try {
    doc = await fbSendDocument(
      row.kind as DocKind,
      auth.accountId,
      auth.token,
      row.fb_invoice_id,
    );
  } catch (e) {
    return { error: `FreshBooks send failed: ${(e as Error).message}` };
  }

  await supabase
    .from("project_invoices")
    .update({ status: mapInvoiceStatus(doc.status ?? "sent") })
    .eq("id", rowId);

  rp(projectId);
  return { ok: true };
}

export async function syncProjectDocument(
  projectId: string,
  rowId: string,
): Promise<BillingActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };

  const { data: row } = await supabase
    .from("project_invoices")
    .select("fb_invoice_id, kind")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return { error: "Document not found." };

  let auth;
  try {
    auth = await getFreshbooksAuth(supabase, account);
  } catch (e) {
    return { error: (e as Error).message };
  }

  let doc;
  try {
    doc = await fbGetDocument(
      row.kind as DocKind,
      auth.accountId,
      auth.token,
      row.fb_invoice_id,
    );
  } catch (e) {
    return { error: `FreshBooks sync failed: ${(e as Error).message}` };
  }

  const status = mapInvoiceStatus(doc.status);
  const amountPaid =
    doc.amount != null && doc.outstanding != null
      ? Math.max(0, doc.amount - doc.outstanding)
      : undefined;

  await supabase
    .from("project_invoices")
    .update({
      status,
      amount: doc.amount ?? undefined,
      ...(amountPaid != null ? { amount_paid: amountPaid } : {}),
    })
    .eq("id", rowId);

  if (row.kind === "invoice" && status === "paid") {
    await supabase
      .from("project_billing")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("project_id", projectId);
  }

  rp(projectId);
  return { ok: true };
}
