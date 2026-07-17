"use client";

// Small "respond by" banner shown to the client at the top of a review. Turns
// red once the date passes. Hidden once the client has made a decision.
export function DueBanner({
  dueDate,
  resolved = false,
}: {
  dueDate: string | null;
  resolved?: boolean;
}) {
  if (!dueDate || resolved) return null;

  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  const pretty = due.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due.getTime() < today.getTime();

  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-[11px] border px-3.5 py-2.5 text-sm ${
        overdue
          ? "border-red/40 bg-red-bg/50 text-red"
          : "border-amber/40 bg-amber-bg/50 text-amber"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="font-semibold">
        {overdue ? `Response was due ${pretty}` : `Please respond by ${pretty}`}
      </span>
    </div>
  );
}
