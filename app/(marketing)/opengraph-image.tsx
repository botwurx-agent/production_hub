import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing/og";

/**
 * The home page's card, and the DEFAULT every marketing route inherits when it
 * does not declare its own. Living in the route group means one file covers
 * anything added later without a second thought.
 */
export const alt = "Studio Flows: the connected production hub for commercial studios";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "The production hub",
    title: "Every job, in one place.",
    body: "Briefs, boards, client approvals, schedules, call sheets and budgets in one organized home, shaped like commercial production actually works.",
    hue: "indigo",
  });
}
