/**
 * A client asking for new work through their request link: the rules both the
 * public form and the server share.
 *
 * NOT `server-only`, for the lib/contact.ts reason: this is the trust boundary
 * between a page anybody holding the link can post to and the studio's deals,
 * so it is the part worth unit testing, and the form mirrors the same limits
 * while the client is still typing.
 */
import { isEmailAddress } from "@/lib/contact";

export const REQUEST_LIMITS = {
  title: 140,
  details: 6000,
  name: 120,
  email: 254,
  /** Files a client can attach to one request. */
  files: 5,
  fileName: 160,
};

/** A brief, a reference deck, a cut to match: documents and media both. */
export const MAX_REQUEST_FILE_BYTES = 200_000_000;

/** The largest budget a request may state; anything past it is a typo. */
const MAX_BUDGET = 100_000_000;

export type RequestInput = {
  title: string;
  details: string;
  neededBy: string;
  budget: string;
  name: string;
  email: string;
};

export type RequestFields = keyof RequestInput | "files";

export type RequestValue = {
  title: string;
  details: string | null;
  neededBy: string | null;
  budget: number | null;
  name: string;
  email: string;
};

export type RequestValid = { ok: true; value: RequestValue };
export type RequestInvalid = { ok: false; field: RequestFields; error: string };

/** A real calendar day, YYYY-MM-DD, so 2026-02-31 does not roll into March. */
export function realDay(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * A typed budget, read the way people type money: "$12,500", "12500",
 * "12.5k". Empty is no budget. Anything else is refused rather than guessed,
 * and "" never becomes $0 (Number("") is 0, the trap this codebase has hit in
 * every money parser it has).
 */
export function parseBudget(raw: string): { ok: true; value: number | null } | { ok: false } {
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "").replace(/usd$/, "");
  if (!s) return { ok: true, value: null };
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return { ok: false };
  let n = Number(m[1]);
  if (m[2] === "k") n *= 1_000;
  if (m[2] === "m") n *= 1_000_000;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_BUDGET) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/**
 * Rejected on the FIRST problem, naming the field, so the form can put the
 * message beside the input that needs fixing. `todayIso` is passed in so the
 * server and the form agree on what "in the past" means.
 */
export function validateRequest(input: RequestInput, todayIso: string): RequestValid | RequestInvalid {
  const title = input.title.replace(/\s+/g, " ").trim();
  const details = input.details.trim();
  const name = input.name.replace(/\s+/g, " ").trim();
  const email = input.email.trim();

  if (!title) return { ok: false, field: "title", error: "Say what you need, in a line." };
  if (title.length > REQUEST_LIMITS.title) {
    return { ok: false, field: "title", error: `Keep this under ${REQUEST_LIMITS.title} characters; the details go below.` };
  }
  if (details.length > REQUEST_LIMITS.details) {
    return { ok: false, field: "details", error: `Keep the details under ${REQUEST_LIMITS.details} characters, or attach a brief.` };
  }

  let neededBy: string | null = null;
  if (input.neededBy.trim()) {
    neededBy = realDay(input.neededBy);
    if (!neededBy) return { ok: false, field: "neededBy", error: "That is not a date." };
    if (neededBy < todayIso.slice(0, 10)) {
      return { ok: false, field: "neededBy", error: "That date has already passed." };
    }
  }

  const budget = parseBudget(input.budget);
  if (!budget.ok) {
    return { ok: false, field: "budget", error: "Enter an amount like 12,500, or leave it blank." };
  }

  if (!name) return { ok: false, field: "name", error: "Tell the studio who is asking." };
  if (name.length > REQUEST_LIMITS.name) return { ok: false, field: "name", error: "That name is too long." };
  if (!email) return { ok: false, field: "email", error: "The studio needs an address to reply to." };
  if (email.length > REQUEST_LIMITS.email || !isEmailAddress(email)) {
    return { ok: false, field: "email", error: "That does not look like an email address." };
  }

  return {
    ok: true,
    value: {
      title,
      details: details || null,
      neededBy,
      budget: budget.value,
      name,
      email,
    },
  };
}

export type DeclaredFile = { name: string; size: number; type: string };

/** The files a client said they will send, checked before any ticket is minted. */
export function validateFiles(
  files: unknown
): { ok: true; files: DeclaredFile[] } | { ok: false; error: string } {
  if (!Array.isArray(files)) return { ok: true, files: [] };
  if (files.length > REQUEST_LIMITS.files) {
    return { ok: false, error: `Attach up to ${REQUEST_LIMITS.files} files. Put more in one zip or share a folder link in the details.` };
  }
  const out: DeclaredFile[] = [];
  for (const f of files) {
    if (!f || typeof f !== "object") return { ok: false, error: "One of the files could not be read." };
    const o = f as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const size = typeof o.size === "number" ? o.size : NaN;
    const type = typeof o.type === "string" ? o.type.slice(0, 120) : "";
    if (!name) return { ok: false, error: "One of the files has no name." };
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: `"${name}" is empty.` };
    if (size > MAX_REQUEST_FILE_BYTES) {
      return { ok: false, error: `"${name}" is over ${Math.round(MAX_REQUEST_FILE_BYTES / 1_000_000)}MB. Share a link to it in the details instead.` };
    }
    out.push({ name: name.slice(-REQUEST_LIMITS.fileName), size, type });
  }
  return { ok: true, files: out };
}

export type StoredRequestFile = { path: string; name: string; size: number; type: string | null };

/** Files out of jsonb: the trust boundary on the way back to the page. */
export function parseRequestFiles(raw: unknown): StoredRequestFile[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredRequestFile[] = [];
  for (const f of raw.slice(0, REQUEST_LIMITS.files)) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    if (typeof o.path !== "string" || !o.path || typeof o.name !== "string") continue;
    const size = typeof o.size === "number" && Number.isFinite(o.size) ? o.size : 0;
    out.push({ path: o.path, name: o.name, size, type: typeof o.type === "string" ? o.type : null });
  }
  return out;
}

/**
 * The deal's notes, so the request reads on the pipeline card and the deal
 * page without opening anything. The request row keeps the fields separately;
 * this is the human summary. Files are not counted here: they upload after
 * the deal exists, and a count written first would be wrong if one failed.
 */
export function dealNotes(v: RequestValue): string {
  const lines = [`Requested by ${v.name} (${v.email}) through the request link.`];
  if (v.neededBy) lines.push(`Needed by ${v.neededBy}.`);
  if (v.details) lines.push("", v.details);
  return lines.join("\n");
}
