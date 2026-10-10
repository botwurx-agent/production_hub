import "server-only";
import { aiConfigured } from "@/lib/ai";
import type { StudioContext } from "@/lib/studio";

/**
 * The single question "may this studio use Runner?".
 *
 * It exists as one function rather than an inline condition because Runner is
 * intended to sit behind a paid tier, and a gate that is spelled out in four
 * places is a gate that will eventually disagree with itself. When a plan
 * column arrives on `studios`, this is the only body that changes and every
 * call site inherits it.
 *
 * Today it answers two things:
 *  - Is a provider key configured at all (otherwise nothing works).
 *  - Is this a studio member (Runner reads costs, deals and contacts, all of
 *    which are is_studio_member, so a project collaborator would get a chat
 *    that could answer nothing).
 *
 * IMPORTANT for whoever adds the tier check: hiding the nav row is not the
 * gate. The gate is the two server-side call sites, the /api/agent route and
 * confirmCard, because those are what a request actually has to pass. The UI
 * check only stops the button being shown to someone who cannot use it.
 */
export function canUseRunner(ctx: StudioContext): boolean {
  return aiConfigured() && !ctx.isCollaborator;
}

/**
 * The single question "may this person make an AI connector link?". The same
 * one-function rule as canUseRunner, for the same reason: a tier check will
 * land here and nowhere else.
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
