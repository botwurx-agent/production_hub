"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type StudioState = { error?: string } | null;

/** The name is set once at signup and then printed on paperwork; keep it a line. */
const MAX_STUDIO_NAME = 80;

/**
 * Rename the studio.
 *
 * THE NAME IS NOT DECORATION: it is the company on a call sheet masthead, the
 * sender line of every invite and client review email, the cover of a binder
 * and the heading of a shared board. It was collected once at signup and then
 * frozen, so a typo or a rebrand was printed on everything for good.
 *
 * ADMINS ONLY, matching the logo and the RLS on `studios` (studios_update is
 * is_studio_admin). The guard here is the readable refusal; the database is
 * the boundary.
 */
export async function renameStudio(formData: FormData): Promise<StudioState> {
  const ctx = await requireStudioContext();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only studio admins can rename the studio." };
  }

  const raw = formData.get("name");
  // Collapse whitespace, since this is printed on a masthead and a stray
  // double space or a pasted newline shows up there rather than here.
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Enter a studio name." };
  if (name.length > MAX_STUDIO_NAME) {
    return { error: `Keep it under ${MAX_STUDIO_NAME} characters.` };
  }
  if (name === ctx.studio.name) return null;

  const supabase = createClient();
  const { error } = await supabase
    .from("studios")
    .update({ name })
    .eq("id", ctx.studio.id);
  if (error) return { error: error.message };

  // The sidebar and the studio switcher render the name in the LAYOUT, so a
  // page-level revalidate would leave the old name on screen next to the new
  // one. Same pair the logo upload uses.
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return null;
}
