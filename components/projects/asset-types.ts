import type { AssetStatus, AssetType, ApprovalStatus } from "@/lib/database.types";
import type { CommentReaction } from "@/lib/review-reactions";

export type VersionComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  reviewer_name: string | null;
  pin_number: number | null;
  pos_x: number | null;
  pos_y: number | null;
  timecode: number | null;
  resolved_at: string | null;
  parent_id: string | null;
  drawing: unknown;
  timecode_end: number | null;
  author_key: string | null;
  edited_at: string | null;
  reactions?: CommentReaction[];
};

export type VersionApproval = {
  id: string;
  status: ApprovalStatus;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
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
  /**
   * A resized copy, for anything drawn at card size. Null for video and for
   * anything with no stored file, so callers fall back to signedUrl.
   */
  thumbUrl: string | null;
  comments: VersionComment[];
  approvals: VersionApproval[];
};

export type AssetWithVersions = {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  current_version_id: string | null;
  created_at: string;
  versions: VersionRow[];
  /**
   * Where the file came from, when it did not come from an upload. For a Gmail
   * import this carries the readable part (who sent it, the subject, the date)
   * as well as the ids, because "which email was this in" is the question the
   * whole documents idea exists to answer, and a message id cannot answer it.
   */
  external_ref?: EmailSource | null;
};

export type EmailSource = {
  source?: string;
  gmail_message_id?: string;
  gmail_attachment_id?: string;
  from?: string;
  subject?: string;
  received_at?: string;
} | null;

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
