"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { createNotification } from "@/lib/notifications";
import { allowPublic } from "@/lib/rate-limit";

export type AcceptState = { error?: string; ok?: boolean } | null;

function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

// Record that the recipient opened the document (first view only).
export async function recordDocView(token: string): Promise<void> {
  if (!allowPublic("p-view", 30)) return;
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  const { data: doc } = await service
    .from("billing_documents")
    .select("id, viewed_at, accepted_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!doc || doc.viewed_at || doc.accepted_at) return;
  await service
    .from("billing_documents")
    .update({ viewed_at: new Date().toISOString() })
    .eq("share_token", token);
}

export async function acceptBillingDoc(
  token: string,
  input: {
    signerName: string;
    signerEmail?: string | null;
    signatureKind: "typed" | "drawn";
    signatureData: string;
  }
): Promise<AcceptState> {
  if (!allowPublic("p-accept"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "This link is not available." };

  const name = input.signerName.trim();
  if (!name) return { error: "Type your name to sign." };
  const data = input.signatureData?.trim() || name;
  if (data.length > 300_000) return { error: "That signature is too large." };
  const kind = input.signatureKind === "drawn" ? "drawn" : "typed";

  const service = createServiceClient();
  const { data: doc } = await service
    .from("billing_documents")
    .select("id, accepted_at, viewed_at, project_id, studio_id, kind")
    .eq("share_token", token)
    .maybeSingle();
  if (!doc) return { error: "This link is no longer active." };
  if (doc.kind !== "proposal")
    return { error: "This document is for review only." };
  if (doc.accepted_at) return { error: "This document has already been signed." };

  const now = new Date().toISOString();
  const { error } = await service
    .from("billing_documents")
    .update({
      status: "accepted",
      accepted_at: now,
      viewed_at: doc.viewed_at ?? now,
      signer_name: name,
      signer_email: input.signerEmail?.trim() || null,
      signature_kind: kind,
      signature_data: data,
      signed_ip: clientIp(),
    })
    .eq("share_token", token);
  if (error) return { error: "Could not record your signature. Try again." };

  const label = "proposal";
  if (doc.project_id) {
    await service.from("activity").insert({
      studio_id: doc.studio_id,
      project_id: doc.project_id,
      type: "activity",
      content: `${name} signed and accepted the ${label}`,
    });
    await createNotification(service, {
      studio_id: doc.studio_id,
      project_id: doc.project_id,
      type: "doc_signed",
      title: `${name} accepted your ${label}`,
      href: `/projects/${doc.project_id}/invoices`,
    });
    revalidatePath(`/projects/${doc.project_id}/invoices`);
  }

  revalidatePath(`/p/${token}`);
  return { ok: true };
}
