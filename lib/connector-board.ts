/**
 * The pure half of the connector's board tools: reading what an assistant
 * sent and deciding where each thing lands on a moodboard.
 *
 * NOT `server-only`, so it is unit tested. The assistant's arguments are the
 * trust boundary here, the same as a model's output anywhere else in this app:
 * junk is dropped with a reason rather than written, and nothing in this file
 * can produce a row the board would not have made through its own buttons.
 */

/** Per call. Each image is a download, and the request has about a minute. */
export const MAX_ENTRIES = 12;
const MAX_TEXT = 2000;
const MAX_NAME = 80;

export type BoardEntry =
  | { type: "image"; url: string; caption: string }
  | { type: "note"; text: string }
  | { type: "heading"; text: string };

export type FrameEntry = {
  imageUrl: string | null;
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
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

export function boardName(v: unknown, fallback: string): string {
  return str(v, MAX_NAME).replace(/\s+/g, " ") || fallback;
}

/** Moodboard entries: images by link, notes and headings. */
export function parseBoardEntries(raw: unknown): { entries: BoardEntry[]; skipped: string[] } {
  const entries: BoardEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    if (entries.length >= MAX_ENTRIES) {
      skipped.push(`Item ${i + 1}: over the ${MAX_ENTRIES} per call limit, send it in another call.`);
      continue;
    }
    if (!item || typeof item !== "object") {
      skipped.push(`Item ${i + 1}: not readable.`);
      continue;
    }
    const o = item as Record<string, unknown>;
    const type = o.type;
    if (type === "image") {
      const url = link(o.url);
      if (!url) {
        skipped.push(`Item ${i + 1}: an image needs a public http(s) link.`);
        continue;
      }
      entries.push({ type: "image", url, caption: str(o.caption, MAX_TEXT) });
    } else if (type === "note" || type === "heading") {
      const text = str(o.text, type === "heading" ? 200 : MAX_TEXT);
      if (!text) {
        skipped.push(`Item ${i + 1}: a ${type} needs text.`);
        continue;
      }
      entries.push({ type, text });
    } else {
      skipped.push(`Item ${i + 1}: unknown type "${String(type)}". Use image, note or heading.`);
    }
  }
  return { entries, skipped };
}

/** Storyboard frames: each may carry a picture, or be text only. */
export function parseFrames(raw: unknown): { frames: FrameEntry[]; skipped: string[] } {
  const frames: FrameEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    if (frames.length >= MAX_ENTRIES) {
      skipped.push(`Frame ${i + 1}: over the ${MAX_ENTRIES} per call limit, send it in another call.`);
      continue;
    }
    if (!item || typeof item !== "object") {
      skipped.push(`Frame ${i + 1}: not readable.`);
      continue;
    }
    const o = item as Record<string, unknown>;
    const rawUrl = str(o.image_url, 2000);
    const imageUrl = link(rawUrl);
    if (rawUrl && !imageUrl) {
      skipped.push(`Frame ${i + 1}: the image link is not a public http(s) link.`);
      continue;
    }
    const f: FrameEntry = {
      imageUrl,
      scene: str(o.scene, 200) || null,
      description: str(o.description, MAX_TEXT) || null,
      sound: str(o.sound, MAX_TEXT) || null,
      notes: str(o.notes, MAX_TEXT) || null,
    };
    if (!f.imageUrl && !f.scene && !f.description && !f.sound && !f.notes) {
      skipped.push(`Frame ${i + 1}: empty.`);
      continue;
    }
    frames.push(f);
  }
  return { frames, skipped };
}

/** A note card holds HTML, so plain text is escaped and kept line by line. */
export function noteHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export const MEDIA_W = 260;
const GAP = 24;
const COLS = 4;
const LEFT = 40;

/** A card's height for a picture of this shape, kept in a sane range. */
export function mediaHeight(width: number | null, height: number | null): number {
  if (!width || !height || width <= 0 || height <= 0) return 200;
  return Math.round(Math.min(520, Math.max(120, (MEDIA_W * height) / width)));
}

export type Placed = { x: number; y: number; w: number; h: number };

/**
 * Where each new card goes: BELOW everything already on the board, never on
 * top of it, in rows of four. A heading takes a row of its own and starts the
 * next group, which is how a person lays a moodboard out by hand.
 */
export function layoutEntries(
  existingBottom: number,
  sizes: { kind: "media" | "note" | "heading"; h: number }[]
): Placed[] {
  const out: Placed[] = [];
  let y = existingBottom > 0 ? existingBottom + 60 : 40;
  let col = 0;
  let rowH = 0;
  const newRow = () => {
    if (col > 0) y += rowH + GAP;
    col = 0;
    rowH = 0;
  };
  for (const s of sizes) {
    if (s.kind === "heading") {
      newRow();
      out.push({ x: LEFT, y, w: 360, h: 60 });
      y += 60 + 12;
      continue;
    }
    const w = s.kind === "note" ? 220 : MEDIA_W;
    if (col >= COLS) newRow();
    out.push({ x: LEFT + col * (MEDIA_W + GAP), y, w, h: s.h });
    rowH = Math.max(rowH, s.h);
    col++;
  }
  return out;
}
