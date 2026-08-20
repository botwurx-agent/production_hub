"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { reportError } from "@/lib/log";

/**
 * Store a rendered page-1 preview for a file that cannot preview itself.
 *
 * A PDF drew a grey document icon in every grid, so a folder of storyboards,
 * treatments and permits all looked the same and you had to open each one to
 * find the one you wanted. There is no server-side rasterizer here and adding
 * one would mean a native dependency on every cold start, so the page is
 * rendered in the BROWSER with the pdf.js that is already loaded for the
 * importer and the review canvas, and the result is posted here.
 *
 * Rendered once, kept forever: the whole point is that the second viewer, and
 * every viewer after them, downloads a 40KB jpeg instead of a 20MB document.
 *
 * The poster is derived data. It carries no access of its own, is never the
 * file anyone opens, and can be deleted at any time: the next view rebuilds it.
 */

/** A page-1 jpeg. Anything larger than this is not one. */
const MAX_POSTER_BYTES = 1_500_000;

export async function savePdfPoster(
  projectId: string,
  versionId: string,
  form: FormData
): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();

  const file = form.get("poster");
  if (!(file instanceof File)) return { error: "No image." };
  // The browser is the only thing that calls this, but it is still a public
  // entry point, so the shape is checked rather than trusted.
  if (file.type !== "image/jpeg") return { error: "Wrong format." };
  if (file.size === 0 || file.size > MAX_POSTER_BYTES)
    return { error: "That preview is not a reasonable size." };

  // The version is readable when is_studio_member OR can_access_project
  // (migration 0056), so a successful read IS the authorization check. It is
  // also how the studio folder is resolved, rather than trusting the caller.
  const { data: version } = await supabase
    .from("versions")
    .select("id, studio_id, poster_path, assets!inner(project_id)")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { error: "You do not have access to that file." };
  // A version id from one project must not be able to write a poster billed to
  // another; the project comes from the URL, so the two are compared.
  const owner = (version.assets as unknown as { project_id: string | null })
    ?.project_id;
  if (owner !== projectId) return { error: "That file is not in this project." };

  // Deterministic path, overwritten in place. A re-render of the same version
  // replaces its poster rather than littering the bucket with orphans.
  const path = `${version.studio_id}/posters/${versionId}.jpg`;

  const { error: upErr } = await assetStorage().upload(
    path,
    await file.arrayBuffer(),
    { contentType: "image/jpeg", upsert: true }
  );
  if (upErr) {
    reportError("savePdfPoster.upload", upErr);
    return { error: "Could not save the preview." };
  }

  if (version.poster_path !== path) {
    const { error } = await supabase
      .from("versions")
      .update({ poster_path: path })
      .eq("id", versionId);
    if (error) {
      reportError("savePdfPoster.update", error);
      return { error: "Could not save the preview." };
    }
  }

  // Deliberately no revalidatePath: the caller already has the image on screen
  // from its own render, and refreshing the page it is standing on to fetch a
  // picture it is already showing would be a visible flash for nothing.
  return { ok: true };
}
