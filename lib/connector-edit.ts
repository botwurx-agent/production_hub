// The pure half of the connector's EDIT tools: reading what the assistant
// wants changed, and recording what each field was before and is now.
//
// No "server-only" on purpose, so this is testable. It is the trust boundary:
// the patch arrives from a model in somebody else's product.
//
// Two rules shape it:
//  - ONLY A FIELD THAT WAS SENT IS TOUCHED. A key left out keeps its value, so
//    "change the movement on 1B" cannot blank the description. An empty string
//    or null CLEARS a field, which is how a producer says "take that off".
//  - EVERY CHANGE IS REPORTED WITH ITS OLD VALUE. Over a connector the edit is
//    applied before anybody sees it, so the before-and-after in the chat is
//    what makes a wrong one visible and reversible by asking.

export const MAX_EDITS = 40;
export const MAX_EDIT_PICTURES = 12;

export type FieldSpec = {
  /** The key the assistant sends, which is also the column. */
  key: string;
  /** How the field is named back to the producer. */
  label: string;
  max: number;
  /** One line (whitespace collapsed) rather than free text. */
  oneLine?: boolean;
  /** A real YYYY-MM-DD day. */
  date?: boolean;
  /** Cannot be cleared (a task's title, a person's name). */
  required?: boolean;
  /** Maps a producer's word onto a stored value; undefined = not understood. */
  map?: (v: string) => string | null | undefined;
};

export type Patch = Record<string, string | null>;
export type Change = { field: string; before: string | null; after: string | null };

function text(v: unknown, max: number, oneLine: boolean): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  if (typeof v !== "string") return "";
  const t = v.replace(/\r\n/g, "\n").trim();
  return (oneLine ? t.replace(/\s+/g, " ") : t).slice(0, max);
}

/** A real calendar day, so 2026-02-31 is refused rather than rolled into March. */
export function realDay(v: unknown): string | null {
  const m = text(v, 40, true).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null;
}

/** True when the assistant actually sent this key. */
export function sent(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key) && o[key] !== undefined;
}

/**
 * The fields of `input` that may be written, cleaned. A field that cannot be
 * read is LEFT ALONE and named in `problems`, never written as a blank.
 */
export function readPatch(
  input: Record<string, unknown>,
  specs: readonly FieldSpec[]
): { patch: Patch; problems: string[] } {
  const patch: Patch = {};
  const problems: string[] = [];
  for (const f of specs) {
    if (!sent(input, f.key)) continue;
    const raw = input[f.key];
    const clearing = raw === null || (typeof raw === "string" && raw.trim() === "");
    if (clearing) {
      if (f.required) problems.push(`${f.label} cannot be empty; left as it was.`);
      else patch[f.key] = null;
      continue;
    }
    if (typeof raw !== "string" && typeof raw !== "number") {
      problems.push(`${f.label} was not readable; left as it was.`);
      continue;
    }
    if (f.date) {
      const d = realDay(raw);
      if (d) patch[f.key] = d;
      else problems.push(`${f.label} was not a real YYYY-MM-DD date; left as it was.`);
      continue;
    }
    const t = text(raw, f.max, !!f.oneLine || !!f.map);
    if (f.map) {
      const mapped = f.map(t);
      if (mapped === undefined) problems.push(`${f.label} "${t.slice(0, 40)}" was not understood; left as it was.`);
      else patch[f.key] = mapped;
      continue;
    }
    if (!t) {
      if (f.required) problems.push(`${f.label} cannot be empty; left as it was.`);
      else patch[f.key] = null;
      continue;
    }
    patch[f.key] = t;
  }
  return { patch, problems };
}

const same = (a: string | null, b: string | null) => (a ?? "") === (b ?? "");

/** Stored values as the strings they are compared and reported as. */
export function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : String(v);
  return s === "" ? null : s;
}

/**
 * What really changes: a patch value equal to what is stored is dropped, so
 * the report never claims an edit that did nothing, and nothing is written
 * for it.
 */
export function changesOf(
  row: Record<string, unknown>,
  patch: Patch,
  specs: readonly FieldSpec[]
): { write: Patch; changes: Change[] } {
  const write: Patch = {};
  const changes: Change[] = [];
  for (const f of specs) {
    if (!(f.key in patch)) continue;
    const before = asText(row[f.key]);
    const after = patch[f.key];
    if (same(before, after)) continue;
    write[f.key] = after;
    changes.push({ field: f.label, before: clip(before), after: clip(after) });
  }
  return { write, changes };
}

/** Long text is cut in the REPORT only; the full value is what is written. */
export function clip(v: string | null, max = 240): string | null {
  if (v === null) return null;
  return v.length > max ? `${v.slice(0, max)}...` : v;
}

/** The list of things to edit, each needing an id. */
export function readUpdates(
  raw: unknown,
  what: string
): { updates: { id: string; input: Record<string, unknown> }[]; skipped: string[] } {
  const updates: { id: string; input: Record<string, unknown> }[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (updates.length >= MAX_EDITS) {
      skipped.push(`${what} ${n}: over the ${MAX_EDITS} per call limit, send it in another call.`);
      continue;
    }
    if (!item || typeof item !== "object") {
      skipped.push(`${what} ${n}: not readable.`);
      continue;
    }
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      skipped.push(`${what} ${n}: no id. Read the ${what.toLowerCase()}s first to get each one's id.`);
      continue;
    }
    if (seen.has(id)) {
      skipped.push(`${what} ${n}: the same id twice in one call; only the first was used.`);
      continue;
    }
    seen.add(id);
    updates.push({ id, input: o });
  }
  return { updates, skipped };
}

/** A public http(s) link, or null. The real SSRF guard is in the fetch. */
export function pictureLink(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 2000) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
