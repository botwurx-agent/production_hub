import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient as createAuthClient } from "@/lib/supabase/server";

/**
 * The human details a mention needs: who wrote it, and what it is about.
 *
 * Kept out of the actions because both the asset path and the doc path need
 * the same two answers, and a second copy would drift.
 */

/**
 * What to call the author in "Fred Nunez mentioned you".
 *
 * THE ROSTER IS THE BEST SOURCE, and this is the first real payoff of
 * contacts.user_id: if the author is on this project's crew list we know their
 * actual NAME, which is what a recipient recognises. Everywhere else in the app
 * still has to fall back to an email address, because no display name is
 * collected at signup (see lib/people-load.ts).
 */
export async function mentionAuthorName(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string
): Promise<string> {
  const { data: onRoster } = await supabase
    .from("contacts")
    .select("name")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (onRoster?.name?.trim()) return onRoster.name.trim();

  // Their own session is always readable, so the address is the fallback
  // identity, same as everywhere else.
  const { data } = await createAuthClient().auth.getUser();
  const email = data.user?.email;
  if (email) return email.split("@")[0];
  return "A teammate";
}

export type MentionSubject = { label: string; projectTitle: string };

/** "Bright Water pack shot (v2)", plus the project it belongs to. */
export async function mentionSubjectForVersion(
  supabase: SupabaseClient<Database>,
  versionId: string
): Promise<MentionSubject> {
  const { data } = await supabase
    .from("versions")
    .select("version_number, asset:assets(name, project:projects(title))")
    .eq("id", versionId)
    .maybeSingle();
  const asset = data?.asset as
    | { name: string | null; project: { title: string } | null }
    | null;
  const name = asset?.name?.trim() || "an asset";
  const v = data?.version_number ? ` (v${data.version_number})` : "";
  return {
    label: `${name}${v}`,
    projectTitle: asset?.project?.title ?? "the project",
  };
}

const DOC_LABELS: Record<string, string> = {
  shot_list: "the shot list",
  storyboard: "the storyboard",
  moodboard: "the moodboard",
  props: "the prop list",
  sequence: "the sequence",
  ai_shot: "a shot",
};

/** "the shot list", plus the project it belongs to. */
export async function mentionSubjectForDoc(
  supabase: SupabaseClient<Database>,
  projectId: string,
  targetType: string
): Promise<MentionSubject> {
  const { data } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  return {
    label: DOC_LABELS[targetType] ?? "the project",
    projectTitle: data?.title ?? "the project",
  };
}
