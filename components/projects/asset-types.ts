import type { AssetStatus, AssetType, ApprovalStatus } from "@/lib/database.types";

export type VersionComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
};

export type VersionApproval = {
  id: string;
  status: ApprovalStatus;
  reviewer_user_id: string | null;
  created_at: string;
};

export type VersionRow = {
  id: string;
  version_number: number;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
  signedUrl: string | null;
  comments: VersionComment[];
  approvals: VersionApproval[];
};

export type AssetWithVersions = {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  current_version_id: string | null;
  versions: VersionRow[];
};

// Roll a version's internal sign-offs into a single signal:
// any "changes requested" wins (red), else any approval (green), else pending.
export type ReviewSummary = {
  label: string;
  hue: "green" | "red" | "yellow";
  approvals: number;
  changes: number;
};

export function summarizeReview(approvals: VersionApproval[]): ReviewSummary {
  const changes = approvals.filter(
    (a) => a.status === "changes_requested"
  ).length;
  const approved = approvals.filter((a) => a.status === "approved").length;
  if (changes > 0)
    return { label: "Changes requested", hue: "red", approvals: approved, changes };
  if (approved > 0)
    return { label: `Approved (${approved})`, hue: "green", approvals: approved, changes };
  return { label: "Pending review", hue: "yellow", approvals: 0, changes: 0 };
}
