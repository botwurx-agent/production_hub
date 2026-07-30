// Project documents: the paperwork side of a job.
//
// A document lives in `assets` with type 'document' rather than in a table of
// its own, because a document has versions (a permit gets reissued, a call
// sheet reaches v3) and a store without version history just recreates
// spec_FINAL_v2.pdf sitting next to spec_FINAL.pdf.
//
// This file holds the small amount of logic that is specific to that side:
// what counts as a document, and how to describe where one came from.

import type { EmailSource } from "@/components/projects/asset-types";

/**
 * Whether a file should be offered a home in Documents rather than Assets.
 *
 * Images and video are creative work by default and go to assets, everything
 * else is paperwork. Deliberately a default, not a rule: the attachment card
 * still offers "Add to assets" alongside, because a PDF storyboard is a real
 * thing and the producer knows which it is better than a mime type does.
 */
export function isDocumentMime(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/")) {
    return false;
  }
  return true;
}

/**
 * The one line that makes a filed document worth having filed: where it came
 * from, in words. Returns null for something uploaded by hand, which needs no
 * explanation.
 */
export function documentSource(ref: EmailSource): string | null {
  if (!ref) return null;
  const who = senderName(ref.from);
  const when = shortWhen(ref.received_at);
  const subject = ref.subject?.trim();

  if (!who && !subject && !when) return null;

  const parts: string[] = [];
  if (who) parts.push(`From ${who}`);
  if (when) parts.push(when);
  const lead = parts.join(", ");

  if (subject) return lead ? `${lead}, re: ${subject}` : `re: ${subject}`;
  return lead || null;
}

/** "Sean Doe <sean@wave.com>" becomes "Sean Doe". */
function senderName(from?: string | null): string | null {
  const raw = (from ?? "").trim();
  if (!raw) return null;
  const named = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  if (named) return named[1].trim();
  const bare = raw.replace(/[<>]/g, "").trim();
  return bare || null;
}

/** An RFC 2822 date header rendered short, or null when it will not parse. */
function shortWhen(value?: string | null): string | null {
  if (!value) return null;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
