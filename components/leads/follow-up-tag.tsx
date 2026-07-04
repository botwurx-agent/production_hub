// Quiet "gone cold, follow up" chip for a lead, with how long it has been quiet.
export function FollowUpTag({ days }: { days: number }) {
  const label = days >= 30 ? "30+ days" : `${days} days`;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: "var(--h-orange-bg)",
        color: "var(--h-orange)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "var(--h-orange)" }}
        aria-hidden="true"
      />
      Follow up · {label}
    </span>
  );
}
