"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";
import { reportError } from "@/lib/log";
import type {
  BillingProfile,
  BillingDocument,
  BillingDocumentLine,
  BillingDocumentAttachment,
  Json,
} from "@/lib/database.types";
import {
  docLabel,
  safeAccent,
  buildDocSnapshot,
  type DocKind,
} from "@/lib/billing-doc";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { headers } from "next/headers";

export type DocState = { error?: string; id?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/invoices`);
  revalidatePath(`/projects/${projectId}`);
}

// Load the studio's billing profile, creating a default row on first use.
async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
): Promise<BillingProfile> {
  const { data } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (data) return data as BillingProfile;
  const { data: created } = await supabase
    .from("billing_profiles")
    .insert({ studio_id: studioId })
    .select("*")
    .single();
  return created as BillingProfile;
}

export async function createBillingDocument(
  projectId: string,
  kind: DocKind,
): Promise<DocState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const profile = await ensureProfile(supabase, ctx.studio.id);

  const series: Record<
    DocKind,
    {
      n: number;
      prefix: string;
      bump: {
        next_estimate_no?: number;
        next_proposal_no?: number;
        next_invoice_no?: number;
      };
    }
  > = {
    estimate: {
      n: profile.next_estimate_no,
      prefix: profile.estimate_prefix,
      bump: { next_estimate_no: profile.next_estimate_no + 1 },
    },
    proposal: {
      n: profile.next_proposal_no,
      prefix: profile.proposal_prefix,
      bump: { next_proposal_no: profile.next_proposal_no + 1 },
    },
    invoice: {
      n: profile.next_invoice_no,
      prefix: profile.invoice_prefix,
      bump: { next_invoice_no: profile.next_invoice_no + 1 },
    },
  };
  const s = series[kind];
  const number = `${s.prefix}${s.n}`;

  await supabase.from("billing_profiles").update(s.bump).eq("id", profile.id);

  const { data: doc, error } = await supabase
    .from("billing_documents")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      kind,
      number,
      terms: profile.default_terms,
      notes: profile.default_notes,
      template: profile.default_doc_template,
      accent_color: profile.default_doc_accent,
      font: profile.default_doc_font,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !doc) return { error: error?.message ?? "Could not create document." };

  // Seed one empty line so the editor isn't blank.
  await supabase.from("billing_document_lines").insert({
    document_id: doc.id,
    studio_id: ctx.studio.id,
    position: 0,
  });

  rp(projectId);
  return { id: doc.id };
}

// Freeze the document into a snapshot and share it: generates the share token
// (once), stores the snapshot so the shared (and, for proposals, signed) version
// can't change, and marks it sent. Works for all kinds; a proposal is the only
// one that invites a signature on the public page. Returns the /p/<token> token.
export async function sendBillingDoc(
  projectId: string,
  docId: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: doc } = await supabase
    .from("billing_documents")
    .select("*, lines:billing_document_lines(*)")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };
  const d = doc as unknown as BillingDocument & { lines: BillingDocumentLine[] };
  if (d.accepted_at) {
    return { error: "This document was already signed and can't be re-sent." };
  }

  const profile = await ensureProfile(supabase, ctx.studio.id);

  const { data: atts } = await supabase
    .from("billing_document_attachments")
    .select("name, storage_path")
    .eq("document_id", docId)
    .order("created_at", { ascending: true });

  const snapshot = buildDocSnapshot({
    doc: d,
    lines: d.lines ?? [],
    profile,
    attachments: (atts ?? []).map((a) => ({
      name: a.name,
      storagePath: a.storage_path,
    })),
  });

  const token = d.share_token ?? generateReviewToken();
  const { error } = await supabase
    .from("billing_documents")
    .update({
      share_token: token,
      snapshot: snapshot as unknown as Json,
      status: "sent",
      sent_at: new Date().toISOString(),
      // Re-sending after a view resets the view marker for the new snapshot.
      viewed_at: null,
    })
    .eq("id", docId);
  if (error) {
    reportError("sendBillingDoc", error);
    return { error: "Could not prepare the document. Try again." };
  }
  rp(projectId);
  return { token };
}

// Canonical origin for links in emails: the configured site URL, else the
// current request host.
function emailOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

// Send the document by email: freezes + shares it (like sendBillingDoc) and then
// emails the recipient the /p/<token> link. Gated on emailConfigured().
export async function emailBillingDoc(
  projectId: string,
  docId: string,
  input: { to: string; subject: string; message?: string }
): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };

  const to = input.to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { error: "Enter a valid recipient email." };
  }

  // Freeze + share first (reuses the snapshot/token logic).
  const shared = await sendBillingDoc(projectId, docId);
  if ("error" in shared) return { error: shared.error };

  const supabase = createClient();
  const { data: doc } = await supabase
    .from("billing_documents")
    .select("kind, number")
    .eq("id", docId)
    .maybeSingle();
  const kind = (doc?.kind as DocKind) ?? "invoice";
  const label = docLabel(kind);
  const number = doc?.number ? ` (${doc.number})` : "";

  const link = `${emailOrigin()}/p/${shared.token}`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `You have a new ${label.toLowerCase()}${number} to review.`,
        kind === "proposal"
          ? "Open it below to review and sign to accept."
          : "Open it below to review the details.",
      ];

  const { html, text } = renderEmail({
    heading: input.subject.trim() || `${label}${number}`,
    lines,
    ctaLabel: `View ${label.toLowerCase()}`,
    ctaUrl: link,
  });

  const result = await sendEmail({
    to,
    subject: input.subject.trim() || `${label}${number}`,
    html,
    text,
  });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  rp(projectId);
  return { ok: true };
}

// Per-document style (template + theme color + font).
export async function updateDocStyle(
  projectId: string,
  id: string,
  patch: { template?: string; accent_color?: string | null; font?: string }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_documents").update(patch).eq("id", id);
  rp(projectId);
}

// Save the current style as the studio-wide default for new documents.
export async function saveDefaultDocStyle(
  projectId: string,
  style: { template: string; accent: string; font: string }
): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const profile = await ensureProfile(supabase, ctx.studio.id);
  await supabase
    .from("billing_profiles")
    .update({
      default_doc_template: style.template,
      default_doc_accent: safeAccent(style.accent),
      default_doc_font: style.font,
    })
    .eq("id", profile.id);
  rp(projectId);
}

// Attach a file to a document (proposals carry supporting docs). Server-side
// upload to the studio-scoped assets bucket, then record the row.
export async function addDocAttachment(
  projectId: string,
  docId: string,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: "File is too large (25MB max)." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${ctx.studio.id}/billing/${docId}/${generateReviewToken()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    reportError("addDocAttachment.upload", upErr);
    return { error: "Could not upload that file. Try again." };
  }

  const { error } = await supabase.from("billing_document_attachments").insert({
    document_id: docId,
    studio_id: ctx.studio.id,
    name: file.name.slice(0, 200),
    storage_path: path,
    content_type: file.type || null,
    size_bytes: file.size,
    created_by: ctx.userId,
  });
  if (error) {
    await supabase.storage.from("assets").remove([path]);
    return { error: "Could not save the attachment." };
  }
  rp(projectId);
  return { ok: true };
}

export async function deleteDocAttachment(
  projectId: string,
  attachmentId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: att } = await supabase
    .from("billing_document_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  await supabase
    .from("billing_document_attachments")
    .delete()
    .eq("id", attachmentId);
  const p = (att as BillingDocumentAttachment | null)?.storage_path;
  if (p) await supabase.storage.from("assets").remove([p]);
  rp(projectId);
}

export async function updateBillingDocument(
  projectId: string,
  id: string,
  patch: {
    number?: string;
    status?: string;
    issue_date?: string;
    due_date?: string | null;
    bill_to_name?: string | null;
    bill_to_company?: string | null;
    bill_to_email?: string | null;
    bill_to_address?: string | null;
    reference?: string | null;
    discount?: number;
    notes?: string | null;
    terms?: string | null;
  },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_documents").update(patch).eq("id", id);
  rp(projectId);
}

export async function setDocumentRecipient(
  projectId: string,
  id: string,
  contactId: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("name, email, company")
    .eq("id", contactId)
    .maybeSingle();
  if (c) {
    await supabase
      .from("billing_documents")
      .update({
        bill_to_name: c.name,
        bill_to_email: c.email,
        bill_to_company: c.company,
      })
      .eq("id", id);
  }
  rp(projectId);
}

export async function deleteBillingDocument(
  projectId: string,
  id: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_documents").delete().eq("id", id);
  rp(projectId);
}

export async function addDocLine(
  projectId: string,
  documentId: string,
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("billing_document_lines")
    .select("position")
    .eq("document_id", documentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("billing_document_lines")
    .insert({
      document_id: documentId,
      studio_id: ctx.studio.id,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add line." };
  rp(projectId);
  return { id: data.id };
}

export async function updateDocLine(
  projectId: string,
  lineId: string,
  patch: { description?: string; rate?: number; qty?: number; tax_rate?: number },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_document_lines").update(patch).eq("id", lineId);
  rp(projectId);
}

export async function deleteDocLine(
  projectId: string,
  lineId: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_document_lines").delete().eq("id", lineId);
  rp(projectId);
}
