// The pure half of sharing a scene builder setup by link. No "server-only" on
// purpose, so it is testable: everything here handles what a guest with no
// account typed or sent.

export const SHARE_MODES = ["view", "copy", "edit"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const SHARE_MODE_LABEL: Record<ShareMode, { label: string; hint: string }> = {
  view: { label: "Can view", hint: "They can look and try things. Nothing they do is saved." },
  copy: { label: "Can edit a copy", hint: "Their changes are saved as their own setup beside yours. Yours is not touched." },
  edit: { label: "Can edit this setup", hint: "Their changes are saved onto this setup itself." },
};

export function isShareMode(v: unknown): v is ShareMode {
  return typeof v === "string" && (SHARE_MODES as readonly string[]).includes(v);
}

/** How many separate guests may save a copy through one link. */
export const MAX_TAKES_PER_LINK = 30;

const oneLine = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const EMAIL = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[^\s@<>"',;:\\]{2,}$/;

/** Who is saving: a name and an email address, or the sentence to show. */
export function cleanGuest(raw: unknown): { name: string; email: string } | { error: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = oneLine(o.name, 80);
  const email = oneLine(o.email, 200).toLowerCase();
  if (!name) return { error: "Add your name so the studio knows whose this is." };
  if (!EMAIL.test(email)) return { error: "Add an email address the studio can reach you at." };
  return { name, email };
}

/**
 * The name a guest's copy is saved under: the setup's name with theirs after
 * it, "Kitchen (Sam Lee)". Applied on every save, so it is written once and
 * never doubled when the name already ends that way.
 */
export function takeName(setupName: string, guestName: string): string {
  const base = oneLine(setupName, 120) || "Untitled setup";
  const who = oneLine(guestName, 80);
  if (!who) return base;
  const tail = ` (${who})`;
  if (base.endsWith(tail)) return base;
  return `${base.slice(0, 120 - tail.length)}${tail}`;
}

/** A guest key is the random per-browser id from the sf_rk cookie. */
export function cleanGuestKey(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}
