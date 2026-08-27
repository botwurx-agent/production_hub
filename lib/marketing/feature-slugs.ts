/**
 * The feature pages' ROOT-LEVEL slugs, alone in their own module.
 *
 * Two files need this list and nothing else from the feature data: the
 * middleware (a page missing from PUBLIC_PATHS silently redirects the
 * logged-out visitor, the one audience a marketing page exists for, to /login)
 * and the dynamic route's static params. Importing all of features.ts into the
 * middleware would carry every page's copy into the edge bundle; duplicating
 * the list would drift the first time a page is added. So the slugs live here,
 * and features.ts types itself against them, which makes "added a page,
 * forgot the middleware" a compile error instead of a production bug.
 *
 * The slugs are KEYWORD-SHAPED on purpose ("call-sheet-software", not
 * "features/production"): the URL is the search term, which is where the SEO
 * value of a page-per-functionality actually lives.
 */
export const FEATURE_SLUGS = [
  "production-hub",
  "production-task-management",
  "storyboard-software",
  "shot-list-software",
  "moodboard-maker",
  "video-review-software",
  "production-communication",
  "call-sheet-software",
  "crew-management-software",
  "production-budgeting-software",
  "production-invoicing",
  "ai-video-production",
  "runner",
] as const;

export type FeatureSlug = (typeof FEATURE_SLUGS)[number];
