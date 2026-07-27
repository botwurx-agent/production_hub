import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CommentReaction } from "@/lib/review-reactions";

// Rolls reaction rows up per comment. `me` is the current viewer's identity:
// a user id internally, or the browser key in the public portal, so the UI can
// show which reactions are the viewer's own and toggle them off.
export async function loadReactions(
  client: SupabaseClient<Database>,
  commentIds: string[],
  me: string | null
): Promise<Map<string, CommentReaction[]>> {
  const byComment = new Map<string, CommentReaction[]>();
  if (commentIds.length === 0) return byComment;

  const { data } = await client
    .from("review_comment_reactions")
    .select("comment_id, emoji, author_id, reviewer_key, reviewer_name")
    .in("comment_id", commentIds);

  for (const r of data ?? []) {
    const list = byComment.get(r.comment_id) ?? [];
    let entry = list.find((e) => e.emoji === r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, mine: false, names: [] };
      list.push(entry);
    }
    entry.count++;
    if (me && (r.author_id === me || r.reviewer_key === me)) entry.mine = true;
    if (r.reviewer_name) entry.names.push(r.reviewer_name);
    byComment.set(r.comment_id, list);
  }
  // Most-reacted first, so the signal reads at a glance.
  for (const list of byComment.values()) list.sort((a, b) => b.count - a.count);
  return byComment;
}
