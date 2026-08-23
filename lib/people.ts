/**
 * A person who can own a task, as far as the browser is concerned.
 *
 * Pure and client-safe on purpose. The half that reads the database lives in
 * lib/people-load.ts, split the same way lib/review-reactions-load.ts is split
 * from lib/review-reactions.ts, because a module carrying `server-only` cannot
 * be imported from a client component and the task list needs both the type and
 * the initials.
 */

export type Person = {
  userId: string;
  /** Best available identity: an email, else a role-shaped stand-in. */
  label: string;
  /** True for the signed-in caller, so the UI can say "you". */
  isSelf: boolean;
  /** Project people are on this job only; members are on the whole studio. */
  scope: "studio" | "project";
};

/**
 * Two letters for an avatar chip, derived from whatever identity we have.
 *
 * Works off the local part of an address, since that is what these labels
 * usually are: "priya.raman@studio.com" gives PR, "sean@studio.com" gives SE.
 */
export function personInitials(label: string): string {
  const name = label.split("@")[0] || label;
  const parts = name.split(/[.\-_\s]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
