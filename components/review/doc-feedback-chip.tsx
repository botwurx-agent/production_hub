import Link from "next/link";

// Shows how many client comments have come back on a shared doc, linking to the
// Review page where the full pinned feedback opens. Renders nothing when zero.
export function DocFeedbackChip({
  projectId,
  count,
}: {
  projectId: string;
  count: number;
}) {
  if (!count) return null;
  return (
    <Link
      href={`/projects/${projectId}/review`}
      title="View client feedback on the Review page"
      className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-bold transition hover:brightness-95"
      style={{
        backgroundColor: "var(--h-amber-bg)",
        color: "var(--h-amber)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {count} client {count === 1 ? "comment" : "comments"}
    </Link>
  );
}
