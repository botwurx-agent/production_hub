// Reading a director's shot list or storyboard out of a document.
//
// Pure module: no provider calls, no server imports, so the trust boundary
// between model output and rows in the operator's shot list can be unit tested.
// Same shape as lib/cast.ts and for the same reason.

export type ShotDocRow = {
  code: string | null;
  description: string | null;
  size: string | null;
  type: string | null;
  movement: string | null;
  day: string | null;
  notes: string | null;
  page: number | null;
};

export type ShotDocPage = {
  page: number;
  panels: number | null;
  cols: number | null;
  rows: number | null;
  captions: string[];
};

export type ShotDocDraft = {
  kind: "shot_list" | "storyboard" | "both" | "neither";
  title: string | null;
  shots: ShotDocRow[];
  pages: ShotDocPage[];
  unreadable: boolean;
};

/** A short printed value. Anything longer is a misread, not a shot size. */
function tag(v: unknown, max = 40): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /^(n\/?a|none|null|-|--)$/i.test(s)) return null;
  return s.slice(0, max);
}

/**
 * A shot code, with list punctuation taken off.
 *
 * A treatment usually numbers its shots as a list ("1." "2."), and the reader
 * is told to copy what is printed, so the full stop arrives with the number.
 * On a shot list that is not part of the code, it is the bullet, and it looks
 * wrong in a code column. Only stripped from a plain number or a number with a
 * letter, so a genuine printed code is never quietly altered.
 */
function shotCode(v: unknown): string | null {
  const s = tag(v, 16);
  if (!s) return null;
  return /^\d+[A-Za-z]?[.)]$/.test(s) ? s.slice(0, -1) : s;
}

function count(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return Math.floor(n);
}

/**
 * The trust boundary between a model reading a director's PDF and rows in the
 * operator's shot list.
 *
 * Caps are the important part. A runaway list is a misread, and every row here
 * becomes a row a human has to delete by hand, so 300 is generous for a real
 * board and still bounded.
 */
export function parseShotDocDraft(raw: string): ShotDocDraft {
  const empty: ShotDocDraft = {
    kind: "neither",
    title: null,
    shots: [],
    pages: [],
    unreadable: true,
  };

  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return empty;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return empty;
  }

  const kindRaw = typeof obj.kind === "string" ? obj.kind : "";
  const kind: ShotDocDraft["kind"] =
    kindRaw === "shot_list" || kindRaw === "storyboard" || kindRaw === "both"
      ? kindRaw
      : "neither";

  const shots: ShotDocRow[] = Array.isArray(obj.shots)
    ? (obj.shots as unknown[])
        .slice(0, 300)
        .map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return {
            code: shotCode(row.code),
            description: tag(row.description, 500),
            size: tag(row.size),
            type: tag(row.type),
            movement: tag(row.movement),
            day: tag(row.day, 24),
            notes: tag(row.notes, 500),
            page: count(row.page, 999),
          };
        })
        // A row with nothing in it but a page number is not a shot.
        .filter((r) => r.code || r.description || r.size || r.movement)
    : [];

  const pages: ShotDocPage[] = Array.isArray(obj.pages)
    ? (obj.pages as unknown[])
        .slice(0, 200)
        .map((p) => {
          const pg = (p ?? {}) as Record<string, unknown>;
          const page = count(pg.page, 999);
          if (page === null) return null;
          return {
            page,
            panels: count(pg.panels, 60),
            cols: count(pg.cols, 12),
            rows: count(pg.rows, 12),
            captions: Array.isArray(pg.captions)
              ? (pg.captions as unknown[])
                  .slice(0, 60)
                  .map((c) => (typeof c === "string" ? c.trim().slice(0, 500) : ""))
              : [],
          };
        })
        .filter((p): p is ShotDocPage => p !== null)
    : [];

  const unreadable = obj.unreadable === true || (kind === "neither" && shots.length === 0);

  return { kind, title: tag(obj.title, 120), shots, pages, unreadable };
}
