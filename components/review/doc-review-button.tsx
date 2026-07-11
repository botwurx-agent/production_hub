import Link from "next/link";

type DocKind = "shot_list" | "storyboard" | "moodboard";

// Links to the full-page comments/review view for a doc. Shows the client-comment
// count as a badge when there is any.
export function DocReviewButton({
  projectId,
  kind,
  targetId,
  count = 0,
}: {
  projectId: string;
  kind: DocKind;
  targetId: string;
  count?: number;
}) {
  return (
    <Link
      href={`/projects/${projectId}/review/doc/${kind}/${targetId}`}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
      title="Open comments"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Comments
      {count > 0 && (
        <span
          className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
          style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
