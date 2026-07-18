"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as db } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import type { ClientType } from "@/lib/database.types";

export type FormState = { error?: string } | null;

export async function createClient(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = db();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the client a name." };
  const type = (String(formData.get("type") ?? "brand") as ClientType) || "brand";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { data, error } = await supabase
    .from("clients")
    .insert({ studio_id: ctx.studio.id, name, type, notes })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

// Create a client without redirecting, returning its id + name. Used for inline
// "add a client" flows (e.g. the new-project wizard) where the caller wants to
// keep working in place and just select the new client.
export async function quickCreateClient(
  name: string,
  type: ClientType = "brand",
): Promise<{ id: string; name: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = db();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give the client a name." };
  const { data, error } = await supabase
    .from("clients")
    .insert({ studio_id: ctx.studio.id, name: trimmed, type })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath("/projects");
  return { id: data.id, name: data.name };
}

export async function updateClient(
  clientId: string,
  patch: { name?: string; type?: ClientType; notes?: string | null }
) {
  await requireStudioContext();
  const supabase = db();
  await supabase.from("clients").update(patch).eq("id", clientId);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function addClientContact(
  clientId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = db();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Contact name is required." };

  const { error } = await supabase.from("contacts").insert({
    studio_id: ctx.studio.id,
    client_id: clientId,
    name,
    role: String(formData.get("role") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return null;
}

export async function deleteContact(contactId: string, revalidate: string) {
  await requireStudioContext();
  const supabase = db();
  await supabase.from("contacts").delete().eq("id", contactId);
  revalidatePath(revalidate);
}
