"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setContactRate } from "@/lib/rates";
import { requireStudioContext } from "@/lib/studio";
import { logWrite } from "@/lib/log";

export type ContactState = { error?: string } | null;

export type ContactInput = {
  name: string;
  type?: string | null; // category: crew | talent | extras | vendor | client
  role?: string | null; // position
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  rate?: number | null;
  notes?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

function cleanRate(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v) || v <= 0) return null;
  return v;
}

const CATEGORIES = ["crew", "talent", "extras", "vendor", "client"];
function cleanType(v: string | null | undefined): string {
  return CATEGORIES.includes(v ?? "") ? (v as string) : "crew";
}

// Add a person to this production's roster (crew, talent, vendor). These are
// project-scoped, distinct from the client/agency contacts that come in via the
// linked client.
export async function addProjectContact(
  projectId: string,
  input: ContactInput
): Promise<ContactState> {
  const ctx = await requireStudioContext();
  const name = input.name.trim();
  if (!name) return { error: "Add a name." };

  const supabase = createClient();
  // Confirm the project belongs to this studio (RLS also enforces it).
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      name,
      type: cleanType(input.type),
      role: clean(input.role),
      company: clean(input.company),
      email: clean(input.email),
      phone: clean(input.phone),
      notes: clean(input.notes),
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Could not add that contact." };

  // The rate is a separate is_studio_member row (migration 0074). A
  // collaborator is refused by RLS rather than by a check here.
  const rateErr = await setContactRate(
    supabase,
    ctx.studio.id,
    created.id,
    cleanRate(input.rate)
  );
  if (rateErr) return rateErr;

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

export async function updateProjectContact(
  projectId: string,
  contactId: string,
  input: ContactInput
): Promise<ContactState> {
  const ctx = await requireStudioContext();
  const name = input.name.trim();
  if (!name) return { error: "Add a name." };

  const supabase = createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      type: cleanType(input.type),
      role: clean(input.role),
      company: clean(input.company),
      email: clean(input.email),
      phone: clean(input.phone),
      notes: clean(input.notes),
    })
    .eq("id", contactId);
  if (error) return { error: error.message };

  // Skipped for a collaborator, who is never shown the real figure, so their
  // form would otherwise post a blank and clear it. RLS would refuse the write
  // anyway; this just avoids surfacing an error for something they cannot see.
  if (!ctx.isCollaborator) {
    const rateErr = await setContactRate(
      supabase,
      ctx.studio.id,
      contactId,
      cleanRate(input.rate)
    );
    if (rateErr) return rateErr;
  }

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

export async function deleteProjectContact(
  projectId: string,
  contactId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await logWrite(
    "deleteProjectContact/contacts",
    supabase.from("contacts").delete().eq("id", contactId)
  );
  revalidatePath(`/projects/${projectId}/contacts`);
}
