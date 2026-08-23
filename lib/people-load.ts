import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StudioContext } from "@/lib/studio";
import type { Person } from "@/lib/people";
import { signThumbs } from "@/lib/asset-storage";
import { assetStorage } from "@/lib/asset-storage";
import type { TaskComment, TaskFile } from "@/lib/tasks";

/**
 * Who can be given a task on this project.
 *
 * `project_tasks.assignee_id` and `crm_tasks.assignee_id` have both existed
 * since their first migration and neither has ever been set, for one reason:
 * there was no way to ask "who is on this job". Every people surface in the app
 * resolves names by hand at the point of use (settings/page.tsx still does it
 * inline), so a second copy was going to appear the moment anything else needed
 * it.
 *
 * WHY EMAILS AND NOT NAMES. Supabase Auth holds the account, and we never
 * collected a display name at signup, so the address IS the identity here. It
 * is also not readable from `auth.users` under RLS, which is why this walks the
 * INVITE that each person accepted: `studio_invites.accepted_by` and
 * `project_invites.accepted_by` point back at the user, and the invite carries
 * the address someone typed. The signed-in caller is the one person we can
 * always name, from their own session.
 *
 * The gap that leaves is real and worth knowing: a studio's OWNER never
 * accepted an invite (they are created by the signup trigger), so from anyone
 * else's session they have no resolvable address and show as "Studio owner".
 * That is a display limit, not an access one, and the honest fix is asking for
 * a name at signup rather than widening what this can read.
 *
 * Split from lib/people.ts because that half is imported by a client component
 * and this half carries `server-only`, the same split as
 * lib/review-reactions-load.ts against lib/review-reactions.ts.
 */

export async function loadProjectPeople(
  supabase: SupabaseClient<Database>,
  ctx: StudioContext,
  projectId: string
): Promise<Person[]> {
  const [{ data: members }, { data: studioInvites }, { data: projectMembers }, { data: projectInvites }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("user_id, role")
        .eq("studio_id", ctx.studio.id)
        .order("created_at"),
      supabase
        .from("studio_invites")
        .select("email, accepted_by")
        .eq("studio_id", ctx.studio.id)
        .not("accepted_by", "is", null),
      supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId),
      supabase
        .from("project_invites")
        .select("email, accepted_by")
        .eq("project_id", projectId)
        .not("accepted_by", "is", null),
    ]);

  const emailByUser = new Map<string, string>();
  for (const inv of studioInvites ?? [])
    if (inv.accepted_by) emailByUser.set(inv.accepted_by, inv.email);
  for (const inv of projectInvites ?? [])
    if (inv.accepted_by) emailByUser.set(inv.accepted_by, inv.email);
  if (ctx.userId && ctx.email) emailByUser.set(ctx.userId, ctx.email);

  // A Map keyed by user id, so somebody who is both a studio member and a
  // project member appears once, as the wider of the two.
  const people = new Map<string, Person>();

  for (const m of members ?? []) {
    people.set(m.user_id, {
      userId: m.user_id,
      label:
        emailByUser.get(m.user_id) ??
        (m.role === "owner" ? "Studio owner" : "Studio member"),
      isSelf: m.user_id === ctx.userId,
      scope: "studio",
    });
  }
  for (const pm of projectMembers ?? []) {
    if (people.has(pm.user_id)) continue;
    people.set(pm.user_id, {
      userId: pm.user_id,
      label:
        emailByUser.get(pm.user_id) ??
        (pm.role === "reviewer" ? "Reviewer" : "On this project"),
      isSelf: pm.user_id === ctx.userId,
      scope: "project",
    });
  }

  // Self first, then studio before project, then alphabetically. Self first
  // because assigning yourself is much the commonest case, especially on the
  // solo studios this ships to.
  return [...people.values()].sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.scope !== b.scope) return a.scope === "studio" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Addresses invited to this project or studio that nobody has accepted yet.
 *
 * Surfaced next to the assignee picker for one reason: an invite creates no
 * user, so an invited person CANNOT be assigned until they accept. Without
 * saying so, inviting a colleague and finding the picker unchanged reads as the
 * invite having failed.
 */
export async function loadPendingInvites(
  supabase: SupabaseClient<Database>,
  ctx: StudioContext,
  projectId: string
): Promise<string[]> {
  const [{ data: studio }, { data: project }] = await Promise.all([
    supabase
      .from("studio_invites")
      .select("email")
      .eq("studio_id", ctx.studio.id)
      .is("accepted_at", null)
      .eq("revoked", false),
    supabase
      .from("project_invites")
      .select("email")
      .eq("project_id", projectId)
      .is("accepted_at", null)
      .eq("revoked", false),
  ]);
  return [
    ...new Set([
      ...(studio ?? []).map((i) => i.email),
      ...(project ?? []).map((i) => i.email),
    ]),
  ];
}


/**
 * Files and notes for every task on a project, in two queries rather than two
 * per card.
 *
 * A project has tens of tasks and each has a handful of either, so loading the
 * lot and grouping in memory is cheaper than an embedded select per task and
 * far cheaper than fetching on open. Signed URLs last an hour, which outlives
 * any single sitting with the board.
 *
 * Comment authors resolve through the same invite walk as loadProjectPeople,
 * for the same reason: auth.users is not readable under RLS and we never
 * collected a display name. An author we cannot name reads as "Someone" rather
 * than as a raw uuid.
 */
export async function loadTaskExtras(
  supabase: SupabaseClient<Database>,
  ctx: StudioContext,
  taskIds: string[],
  people: Person[]
): Promise<{
  files: Map<string, TaskFile[]>;
  comments: Map<string, TaskComment[]>;
}> {
  const files = new Map<string, TaskFile[]>();
  const comments = new Map<string, TaskComment[]>();
  if (taskIds.length === 0) return { files, comments };

  const [{ data: fileRows }, { data: commentRows }] = await Promise.all([
    supabase
      .from("project_task_files")
      .select("id, task_id, name, storage_path, mime_type, size_bytes")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("project_task_comments")
      .select("id, task_id, author_id, body, created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true }),
  ]);

  const rows = fileRows ?? [];
  const paths = rows.map((r) => r.storage_path);
  const [signed, thumbs] = await Promise.all([
    paths.length
      ? assetStorage().createSignedUrls(paths, 60 * 60)
      : Promise.resolve({ data: null }),
    signThumbs(
      rows.filter((r) => r.mime_type?.startsWith("image/")).map((r) => r.storage_path)
    ),
  ]);
  const urlByPath = new Map<string, string>();
  for (const item of signed.data ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  for (const r of rows) {
    const list = files.get(r.task_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      url: urlByPath.get(r.storage_path) ?? null,
      thumbUrl: thumbs.get(r.storage_path) ?? null,
    });
    files.set(r.task_id, list);
  }

  const labelByUser = new Map(people.map((p) => [p.userId, p.isSelf ? "You" : p.label]));
  for (const c of commentRows ?? []) {
    const list = comments.get(c.task_id) ?? [];
    list.push({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: (c.author_id && labelByUser.get(c.author_id)) || "Someone",
      mine: c.author_id === ctx.userId,
    });
    comments.set(c.task_id, list);
  }

  return { files, comments };
}
