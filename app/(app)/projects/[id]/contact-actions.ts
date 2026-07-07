"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type ContactState = { error?: string } | null;

export type ContactInput = {
  name: string;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
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

  const { error } = await supabase.from("contacts").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    name,
    role: clean(input.role),
    company: clean(input.company),
    email: clean(input.email),
    phone: clean(input.phone),
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

export async function updateProjectContact(
  projectId: string,
  contactId: string,
  input: ContactInput
): Promise<ContactState> {
  await requireStudioContext();
  const name = input.name.trim();
  if (!name) return { error: "Add a name." };

  const supabase = createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      role: clean(input.role),
      company: clean(input.company),
      email: clean(input.email),
      phone: clean(input.phone),
    })
    .eq("id", contactId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

export async function deleteProjectContact(
  projectId: string,
  contactId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("contacts").delete().eq("id", contactId);
  revalidatePath(`/projects/${projectId}/contacts`);
}
