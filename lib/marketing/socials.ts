/**
 * The studio's social profiles, shown as icons in the site footer and listed
 * as `sameAs` on the Organization structured data.
 *
 * An entry with no `url` renders NOTHING, on purpose: a footer icon that leads
 * to a profile we do not own (or to a handle somebody else holds) is worse than
 * no icon. Paste the real profile address in to switch a network on.
 */
export type SocialNetwork =
  | "instagram"
  | "linkedin"
  | "youtube"
  | "vimeo"
  | "x"
  | "tiktok";

export type Social = { network: SocialNetwork; label: string; url: string };

export const SOCIALS: Social[] = [
  { network: "instagram", label: "Instagram", url: "https://www.instagram.com/studio.flowss/" },
  { network: "linkedin", label: "LinkedIn", url: "" },
  { network: "youtube", label: "YouTube", url: "" },
  { network: "vimeo", label: "Vimeo", url: "" },
  { network: "x", label: "X", url: "" },
  { network: "tiktok", label: "TikTok", url: "" },
];

/** Only the networks with a real address. */
export const LIVE_SOCIALS = SOCIALS.filter((s) => /^https:\/\//.test(s.url));
