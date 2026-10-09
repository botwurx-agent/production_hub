/**
 * Transcripts of a video or audio version: the rules both sides share.
 *
 * Pure and not `server-only`, so the browser (which pulls the audio out of a
 * cut, splits it and encodes it), the server (which reads the provider's
 * answer and checks what comes back to be saved) and the scratchpad tests all
 * read one module.
 *
 * WHY THE BROWSER DOES THE AUDIO. A cut can be a gigabyte, the transcription
 * API takes 25MB, and a Server Action takes about 4MB. There is no ffmpeg on
 * the platform. The browser can decode the cut's audio itself, resampled to
 * 16kHz mono, which is about 32KB a second as 16-bit WAV, and send it in
 * pieces of under two minutes. The bytes of the cut never move again.
 */

export type Segment = { start: number; end: number; text: string };

export type TranscriptData = {
  segments: Segment[];
  language: string | null;
  duration: number | null;
  updatedAt: string | null;
};

/** The rate everything is decoded to. Speech needs nothing more. */
export const TRANSCRIBE_RATE = 16000;
/** Where a piece is cut, give or take the search window. */
export const CHUNK_TARGET_SECONDS = 90;
/**
 * A piece may never run past this. 115 seconds of 16-bit mono at 16kHz is
 * 3.68MB, under the 4MB a Server Action carries with room for the form.
 */
export const CHUNK_MAX_SECONDS = 115;
/** How far either side of the target to look for a quiet moment to cut at. */
export const CHUNK_SEARCH_SECONDS = 8;
/** Decoding holds the whole soundtrack in memory, so a ceiling on length. */
export const MAX_TRANSCRIBE_SECONDS = 45 * 60;
/** And on the file the browser has to download to decode it. */
export const MAX_TRANSCRIBE_BYTES = 1_500_000_000;

const MAX_SEGMENTS = 6000;
const MAX_SEGMENT_CHARS = 1000;

function num(v: unknown): number | null {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Collapse whitespace; a transcript line is one line. */
function clean(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

/**
 * The trust boundary for anything coming back to be stored or read out of
 * jsonb: a list of {start, end, text}, finite, non-negative, in order, capped.
 * Anything that is not a line of speech is dropped rather than repaired.
 */
export function parseSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  const out: Segment[] = [];
  for (const r of raw.slice(0, MAX_SEGMENTS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const start = num(o.start);
    const end = num(o.end);
    const text = clean(o.text).slice(0, MAX_SEGMENT_CHARS);
    if (start == null || end == null || start < 0 || !text) continue;
    out.push({ start: round2(start), end: round2(Math.max(end, start)), text });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Whisper's verbose_json answer for one piece, shifted to where the piece sits
 * in the cut. A segment Whisper itself thinks is probably not speech AND has
 * low confidence is dropped: that pair is the signature of the invented line
 * ("Thank you for watching") it produces over room tone.
 */
export function parseWhisper(
  json: unknown,
  offset: number
): { segments: Segment[]; language: string | null } {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const raw = Array.isArray(o.segments) ? o.segments : [];
  const kept = raw.filter((s) => {
    if (!s || typeof s !== "object") return false;
    const r = s as Record<string, unknown>;
    const noSpeech = num(r.no_speech_prob) ?? 0;
    const logprob = num(r.avg_logprob) ?? 0;
    return !(noSpeech > 0.6 && logprob < -1);
  });
  const shifted = parseSegments(kept).map((s) => ({
    start: round2(s.start + offset),
    end: round2(s.end + offset),
    text: s.text,
  }));
  const language = typeof o.language === "string" && o.language.trim() ? o.language.trim().slice(0, 40) : null;
  return { segments: shifted, language };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Root mean square of samples[from, to). */
function rms(samples: ArrayLike<number>, from: number, to: number): number {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, from); i < Math.min(samples.length, to); i++) {
    sum += samples[i] * samples[i];
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
}

/**
 * Where to cut a soundtrack into pieces, as [startSample, endSample) pairs.
 * Each cut lands on the quietest tenth of a second near the target, so a word
 * is not split down the middle (which loses it from both pieces).
 */
export function planChunks(
  samples: ArrayLike<number>,
  rate: number,
  opts: { target?: number; max?: number; search?: number } = {}
): [number, number][] {
  const target = Math.round((opts.target ?? CHUNK_TARGET_SECONDS) * rate);
  const max = Math.round((opts.max ?? CHUNK_MAX_SECONDS) * rate);
  const search = Math.round((opts.search ?? CHUNK_SEARCH_SECONDS) * rate);
  const win = Math.max(1, Math.round(rate / 10));
  const total = samples.length;
  const out: [number, number][] = [];
  let pos = 0;
  while (total - pos > max) {
    const lo = pos + Math.max(win, target - search);
    const hi = Math.min(pos + max - win, pos + target + search);
    let best = Math.min(pos + target, pos + max);
    let bestLevel = Infinity;
    for (let at = lo; at <= hi; at += win) {
      const level = rms(samples, at, at + win);
      if (level < bestLevel) {
        bestLevel = level;
        best = at + Math.floor(win / 2);
      }
    }
    out.push([pos, best]);
    pos = best;
  }
  if (total > pos) out.push([pos, total]);
  return out;
}

/**
 * True when nothing in samples[from, to) rises above room tone. A silent piece
 * is skipped rather than sent: it costs money and is exactly where the model
 * invents lines.
 */
export function chunkIsSilent(
  samples: ArrayLike<number>,
  rate: number,
  from: number,
  to: number,
  threshold = 0.006
): boolean {
  const win = Math.max(1, Math.round(rate / 10));
  for (let at = from; at < to; at += win) {
    if (rms(samples, at, Math.min(to, at + win)) >= threshold) return false;
  }
  return true;
}

/** 16-bit mono PCM WAV. */
export function encodeWav(samples: ArrayLike<number>, rate: number): Uint8Array {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/**
 * The end of what has been heard so far, handed to the next piece as context
 * so a name spelled one way in minute one is spelled the same in minute two.
 */
export function promptTail(segments: Segment[], chars = 220): string {
  const text = segments.map((s) => s.text).join(" ");
  if (text.length <= chars) return text;
  const cut = text.slice(text.length - chars);
  const space = cut.indexOf(" ");
  return space > 0 ? cut.slice(space + 1) : cut;
}

/** The line being spoken at time t, or -1. */
export function segmentAt(segments: Segment[], t: number): number {
  let found = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= t + 0.05) found = i;
    else break;
  }
  if (found >= 0 && t > segments[found].end + 1.5) return -1;
  return found;
}

/** Indices of lines containing every word of the query, case-insensitive. */
export function searchSegments(segments: Segment[], query: string): number[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: number[] = [];
  segments.forEach((s, i) => {
    const t = s.text.toLowerCase();
    if (words.every((w) => t.includes(w))) hits.push(i);
  });
  return hits;
}

function stamp(t: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (x: number, w = 2) => String(x).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

/** A caption never ends before it starts, and never a frame long. */
function captionEnd(s: Segment): number {
  return Math.max(s.end, s.start + 0.5);
}

export function toSrt(segments: Segment[]): string {
  return segments
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(captionEnd(s), ",")}\n${s.text}\n`
    )
    .join("\n");
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map((s) => `${stamp(s.start, ".")} --> ${stamp(captionEnd(s), ".")}\n${s.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Plain text with a timecode per line, for pasting into an email or a doc. */
export function toText(segments: Segment[]): string {
  return segments.map((s) => `[${clock(s.start)}] ${s.text}`).join("\n");
}

/** "1:05", "1:02:09". */
export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
