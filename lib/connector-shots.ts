/**
 * The pure half of the connector's shot list tools: reading the rows an
 * assistant sent. NOT `server-only`, so it is unit tested; the assistant's
 * arguments are the trust boundary, the same as in lib/connector-board.ts.
 */

/** Rows per call. Text is cheap, so this is higher than a board's 12. */
export const MAX_SHOTS = 40;
/** Pictures per call: each is a download, and the request has about a minute. */
export const MAX_SHOT_PICTURES = 12;
const MAX_TEXT = 2000;

export type ShotEntry = {
  imageUrl: string | null;
  code: string | null;
  description: string | null;
  shotSize: string | null;
  shotType: string | null;
  movement: string | null;
  day: string | null;
  vo: string | null;
};

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function oneLine(v: unknown, max: number): string | null {
  return str(v, max).replace(/\s+/g, " ") || null;
}

function link(v: unknown): string | null {
  const s = str(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A shot list's name. Shot lists are usually named after the cut or the day
 * they cover ("Hero :30", "Day 2 product"), so it stays short.
 */
export function shotListTitle(v: unknown): string {
  return oneLine(v, 80) ?? "Shot list";
}

/**
 * Rows to add. A row needs SOMETHING written on it: an empty row is what the
 * app's own "New shot list" seeds for a person to fill, which is no use from
 * an assistant. A bad picture link drops only the picture, never the row,
 * since a missing row would renumber the list.
 */
export function parseShots(raw: unknown): { shots: ShotEntry[]; skipped: string[] } {
  const shots: ShotEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  let pictures = 0;
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (shots.length >= MAX_SHOTS) {
      skipped.push(`Shot ${n}: over the ${MAX_SHOTS} per call limit, send it in another call.`);
      continue;
    }
    if (!item || typeof item !== "object") {
      skipped.push(`Shot ${n}: not readable.`);
      continue;
    }
    const o = item as Record<string, unknown>;
    const rawUrl = str(o.image_url, 2000);
    let imageUrl = link(rawUrl);
    if (rawUrl && !imageUrl) {
      skipped.push(`Shot ${n}: the picture link is not a public http(s) link; added without it.`);
    }
    if (imageUrl && pictures >= MAX_SHOT_PICTURES) {
      skipped.push(
        `Shot ${n}: over ${MAX_SHOT_PICTURES} pictures per call; added without it, so send the picture again in another call.`
      );
      imageUrl = null;
    }
    const s: ShotEntry = {
      imageUrl,
      code: oneLine(o.code, 20),
      description: str(o.description, MAX_TEXT) || null,
      shotSize: oneLine(o.shot_size, 60),
      shotType: oneLine(o.shot_type, 60),
      movement: oneLine(o.movement, 60),
      day: oneLine(o.day, 30),
      vo: str(o.vo, MAX_TEXT) || null,
    };
    const hasText = s.code || s.description || s.shotSize || s.shotType || s.movement || s.day || s.vo;
    if (!hasText && !s.imageUrl) {
      skipped.push(`Shot ${n}: empty.`);
      continue;
    }
    if (s.imageUrl) pictures++;
    shots.push(s);
  }
  return { shots, skipped };
}
