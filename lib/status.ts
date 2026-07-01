import type { Hue } from "@/components/status-tag";
import type {
  AssetStatus,
  LeadStage,
  ProjectStatus,
  ApprovalStatus,
} from "@/lib/database.types";

/**
 * Single source of truth for how production states map to color-as-signal.
 * Every status label and hue lives here so the whole app stays consistent and
 * nothing hardcodes a color. Labels use production language, not db values.
 */

export const PROJECT_STATUS: Record<
  ProjectStatus,
  { label: string; hue: Hue; order: number }
> = {
  pre_pro: { label: "Pre-pro", hue: "blue", order: 0 },
  shoot: { label: "Shoot", hue: "orange", order: 1 },
  post: { label: "Post", hue: "purple", order: 2 },
  delivered: { label: "Delivered", hue: "green", order: 3 },
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "pre_pro",
  "shoot",
  "post",
  "delivered",
];

export const ASSET_STATUS: Record<AssetStatus, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "cyan" },
  in_review: { label: "In review", hue: "yellow" },
  needs_changes: { label: "Needs changes", hue: "red" },
  approved: { label: "Approved", hue: "green" },
  delivered: { label: "Delivered", hue: "green" },
};

export const LEAD_STAGE: Record<
  LeadStage,
  { label: string; hue: Hue; order: number }
> = {
  new: { label: "New", hue: "blue", order: 0 },
  contacted: { label: "Contacted", hue: "cyan", order: 1 },
  qualified: { label: "Qualified", hue: "indigo", order: 2 },
  proposal: { label: "Proposal", hue: "purple", order: 3 },
  won: { label: "Won", hue: "green", order: 4 },
  lost: { label: "Lost", hue: "red", order: 5 },
};

export const LEAD_STAGE_ORDER: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "won",
  "lost",
];

export const APPROVAL_STATUS: Record<
  ApprovalStatus,
  { label: string; hue: Hue }
> = {
  pending: { label: "Pending", hue: "yellow" },
  approved: { label: "Approved", hue: "green" },
  changes_requested: { label: "Changes requested", hue: "red" },
};

export const ASSET_TYPE_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  storyboard: "Storyboard",
  reference: "Reference",
  cut: "Cut",
  other: "Other",
};

// Preview tint per asset category (color-as-signal on the asset grid).
export const ASSET_TYPE_HUE: Record<string, Hue> = {
  image: "blue",
  video: "orange",
  storyboard: "green",
  reference: "pink",
  cut: "purple",
  other: "cyan",
};

export const ASSET_STATUS_ORDER: (keyof typeof ASSET_STATUS)[] = [
  "draft",
  "in_review",
  "needs_changes",
  "approved",
  "delivered",
];
