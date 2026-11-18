import "server-only";
import type { StudioContext } from "@/lib/studio";

/**
 * The single question "may this person make an AI connector link?". One
 * function rather than an inline condition, so a tier check lands here and
 * nowhere else.
 *
 * Studio members only. The connector reads money, deals and contacts, all of
 * which are is_studio_member, so a project collaborator's link could answer
 * almost nothing, and the endpoint independently refuses any link whose owner
 * has no membership row. No AI key is needed on our side: the customer's own
 * Claude or ChatGPT does the thinking, which is the point of it.
 */
export function canUseConnector(ctx: StudioContext): boolean {
  return !ctx.isCollaborator;
}
