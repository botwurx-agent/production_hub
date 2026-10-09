/**
 * Voice notes on review comments: the rules both sides share.
 *
 * Pure and not `server-only`, so the recorder (which caps the length), the
 * upload actions (which check the file) and the comment actions (which check
 * the path they are handed back) read one set of numbers.
 *
 * THE PATH COMES BACK FROM THE BROWSER. A note is uploaded first and its path
 * is then handed to the comment action, so a caller could hand in any path,
 * including another studio's file, and get a comment that plays it. So a path
 * is only accepted inside the folder the uploader was given: the studio's own
 * `voice/` folder, under the signed-in user or the review link, as one file
 * segment with nothing after it.
 */

/** Two minutes. A review note, not a podcast; and it keeps the file small. */
export const MAX_VOICE_SECONDS = 120;

/**
 * The note crosses a Server Action, so it must stay under the ~4.5MB request
 * body. Two minutes of opus or AAC at a speech bitrate is well under 2MB.
 */
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
};

/** The base mime type, without codec parameters, or null if not accepted. */
export function voiceMime(mime: string | null | undefined): string | null {
  const base = (mime ?? "").split(";")[0].trim().toLowerCase();
  return base in MIME_EXT ? base : null;
}

export function voiceExt(mime: string): string {
  return MIME_EXT[voiceMime(mime) ?? ""] ?? "webm";
}

/**
 * What the recorder should ask for, best first. AAC in MP4 first because it
 * plays on every browser, Safari included; WebM/Opus is what Chrome and
 * Firefox actually record. Never a bare "video/mp4": Chromium without H.264
 * says yes to it and writes something QuickTime cannot open.
 */
export const RECORDER_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

/** The folder an uploader writes into. One segment per owner, no slashes in ids. */
export function voiceFolder(
  studioId: string,
  owner: { userId: string } | { linkId: string }
): string {
  const who = "userId" in owner ? `u-${owner.userId}` : `l-${owner.linkId}`;
  return `${studioId}/voice/${who}/`;
}

/**
 * True when `path` is exactly one file directly inside `folder`. A whole
 * segment is matched, so a studio id that merely shares a prefix, a deeper
 * path, or a traversal cannot pass.
 */
export function voicePathAllowed(path: unknown, folder: string): path is string {
  if (typeof path !== "string" || !path.startsWith(folder)) return false;
  const file = path.slice(folder.length);
  return /^[A-Za-z0-9_-]{8,80}\.[a-z0-9]{2,5}$/.test(file);
}

/** Seconds as stored: one decimal, clamped, null for anything unreadable. */
export function voiceSeconds(raw: unknown): number | null {
  // Number("") is 0, which would read a missing duration as a silent note.
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(Math.min(n, MAX_VOICE_SECONDS + 5) * 10) / 10;
}

/** "0:42", "1:05". */
export function fmtVoice(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
