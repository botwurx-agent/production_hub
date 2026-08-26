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

/* -------------------------------------------------------------------------- */
/* Matching shot rows to storyboard panels                                     */
/* -------------------------------------------------------------------------- */

/** A cropped panel, as far as matching is concerned. */
export type PanelRef = {
  /** 1-based page it was cropped from. */
  page: number;
  /** Its reading-order position within that page, from 0. */
  index: number;
  /** The number printed with it, where the caption had one. */
  code: string | null;
};

/** Codes are compared as identity, so punctuation and case cannot separate them. */
function codeKey(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/[^0-9a-z]/gi, "").toUpperCase();
  return s || null;
}

/**
 * Which panel belongs to which shot row.
 *
 * One import produces both a storyboard and a shot list when the document
 * holds both, and until now the shot rows arrived with no picture even though
 * the matching frame had just been cropped from the same page. Not a decision,
 * a gap: nothing connected the two halves.
 *
 * Returns a panel index per shot, or null where nothing can be said. THREE
 * PASSES, strongest evidence first, and each one only claims what it can
 * actually prove:
 *
 * 1. THE PRINTED NUMBER. A row reading "1B" and a panel captioned "SHOT 1B The
 *    Reveal" are the same beat, and that is the document asserting it rather
 *    than us inferring it. Only used where the number is unique on BOTH sides,
 *    since a code appearing twice identifies nothing.
 *
 * 2. THE PAGE. The reader records which page each row came off, and a panel
 *    knows the page it was cut from. Where a page's leftover rows and leftover
 *    panels come to the same count, they pair in reading order.
 *
 * 3. WHOLE-DOCUMENT ORDER, and only when the first two passes matched NOTHING
 *    AT ALL and the two counts are equal. A document where some rows matched
 *    and some did not is telling us the two lists are not parallel, so pairing
 *    the remainder by position would be inventing a link rather than reading
 *    one. An unmatched row simply arrives without a picture, which is what it
 *    does today and is easy to fix by hand.
 */
export function matchShotsToPanels(
  shots: ShotDocRow[],
  panels: PanelRef[]
): (number | null)[] {
  const out: (number | null)[] = shots.map(() => null);
  const takenPanel = new Set<number>();

  // 1. By printed number.
  const panelByCode = new Map<string, number | "many">();
  panels.forEach((p, i) => {
    const key = codeKey(p.code);
    if (!key) return;
    panelByCode.set(key, panelByCode.has(key) ? "many" : i);
  });
  const shotCodeCount = new Map<string, number>();
  for (const s of shots) {
    const key = codeKey(s.code);
    if (key) shotCodeCount.set(key, (shotCodeCount.get(key) ?? 0) + 1);
  }
  shots.forEach((s, si) => {
    const key = codeKey(s.code);
    if (!key || shotCodeCount.get(key) !== 1) return;
    const hit = panelByCode.get(key);
    if (typeof hit !== "number" || takenPanel.has(hit)) return;
    out[si] = hit;
    takenPanel.add(hit);
  });
  const matchedByCode = takenPanel.size;

  // 2. By page, in reading order, where the counts on that page agree.
  const pages = new Set<number>();
  for (const s of shots) if (s.page !== null) pages.add(s.page);
  for (const page of pages) {
    const rows = shots
      .map((s, si) => ({ s, si }))
      .filter(({ s, si }) => s.page === page && out[si] === null)
      .map(({ si }) => si);
    const free = panels
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p.page === page && !takenPanel.has(i))
      .sort((a, b) => a.p.index - b.p.index)
      .map(({ i }) => i);
    if (!rows.length || rows.length !== free.length) continue;
    rows.forEach((si, n) => {
      out[si] = free[n];
      takenPanel.add(free[n]);
    });
  }

  // 3. Whole-document order, only when nothing else spoke and the two lists
  //    are the same length.
  //
  //    Blocked when BOTH sides printed numbers, because then numbering was the
  //    identity mechanism and it did not agree, which is the document saying
  //    these two lists are not parallel. Where only one side numbers its
  //    entries, no assertion was made or broken, so position is all there is
  //    and using it is reasonable.
  const numberedBothSides =
    shots.some((s) => codeKey(s.code)) && panels.some((p) => codeKey(p.code));
  if (
    !numberedBothSides &&
    takenPanel.size === 0 &&
    matchedByCode === 0 &&
    shots.length > 0 &&
    shots.length === panels.length
  ) {
    const order = panels
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p.page - b.p.page || a.p.index - b.p.index)
      .map(({ i }) => i);
    shots.forEach((_, si) => {
      out[si] = order[si];
    });
  }

  return out;
}
