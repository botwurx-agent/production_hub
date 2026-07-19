import "server-only";
import { safeFetch, isFetchableUrl, BROWSER_UA } from "@/lib/unfurl";

// Pull a real media file (video or image) from a pasted link, so a studio can
// bring generated clips from an external tool (Higgsfield, etc.) straight into a
// shot without the download / re-upload round trip. Two shapes are handled:
//   1. a direct media URL (ends in .mp4/.webm/.png/... or serves a video/image
//      content-type) -> downloaded as-is.
//   2. a share / watch page (HTML) -> we parse Open Graph / Twitter tags for the
//      underlying video (or image poster) and download that.
// SSRF-safe throughout (every hop goes through safeFetch, which re-validates DNS
// on each redirect). Best-effort: any failure returns a typed { error } rather
// than throwing, so a batch import can report per-link results.

// Cap a single download so one huge file can't exhaust server memory. Generated
// clips are short (a few MB to tens of MB); 200MB is comfortable headroom.
const MAX_BYTES = 200 * 1024 * 1024;

export type FetchedMedia = {
  bytes: Buffer;
  contentType: string;
  kind: "video" | "image";
  sourceUrl: string; // the link the user pasted (kept as provenance)
  filename: string;
  // Auto-derived provenance (best-effort; null when not determinable).
  width: number | null;
  height: number | null;
  durationSec: number | null;
  platform: string | null;
  description: string | null; // a prompt hint from the page, when present
};

// ---- Auto-derived provenance -----------------------------------------------

// Infer the generation platform from the link's host. Editable after; a hint,
// never authoritative.
const PLATFORM_HOSTS: [string, string][] = [
  ["higgsfield", "Higgsfield"],
  ["klingai", "Kling"],
  ["kling", "Kling"],
  ["runwayml", "Runway"],
  ["runway", "Runway"],
  ["pika", "Pika"],
  ["lumalabs", "Luma"],
  ["luma", "Luma"],
  ["midjourney", "Midjourney"],
  ["leonardo", "Leonardo"],
  ["minimax", "Hailuo"],
  ["hailuo", "Hailuo"],
  ["ideogram", "Ideogram"],
  ["krea", "Krea"],
  ["sora", "Sora"],
  ["fal.ai", "fal"],
  ["fal.media", "fal"],
  ["heygen", "HeyGen"],
  ["veo", "Veo"],
];

export function detectPlatform(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    for (const [needle, label] of PLATFORM_HOSTS) {
      if (host.includes(needle)) return label;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function aspectRatio(w: number | null, h: number | null): string | null {
  if (!w || !h) return null;
  const common: [number, number][] = [
    [16, 9], [9, 16], [4, 3], [3, 4], [1, 1], [21, 9], [3, 2], [2, 3], [5, 4], [4, 5],
  ];
  for (const [cw, ch] of common) {
    if (Math.abs(w / h - cw / ch) < 0.02) return `${cw}:${ch}`;
  }
  const g = gcd(w, h) || 1;
  const rw = w / g;
  const rh = h / g;
  if (rw > 40 || rh > 40) return null; // avoid noisy ratios
  return `${rw}:${rh}`;
}

export function resolutionLabel(
  w: number | null,
  h: number | null,
  kind: "video" | "image",
): string | null {
  if (!w || !h) return null;
  if (kind === "video") {
    const short = Math.min(w, h);
    if (short >= 2160) return "4K";
    if (short >= 1440) return "1440p";
    if (short >= 1080) return "1080p";
    if (short >= 720) return "720p";
    if (short >= 480) return "480p";
    return `${w}×${h}`;
  }
  return `${w}×${h}`;
}

// Image dimensions from the file header (PNG / JPEG / GIF / WEBP-VP8X).
function imageDimensions(b: Buffer): { w: number; h: number } | null {
  try {
    // PNG
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // GIF
    if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
      return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    }
    // JPEG
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let pos = 2;
      while (pos + 9 < b.length) {
        if (b[pos] !== 0xff) break;
        const marker = b[pos + 1];
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);
        if (isSOF) {
          return { h: b.readUInt16BE(pos + 5), w: b.readUInt16BE(pos + 7) };
        }
        pos += 2 + b.readUInt16BE(pos + 2);
      }
    }
    // WEBP (VP8X extended header)
    if (
      b.length > 30 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP"
    ) {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8X") {
        const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
        const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
        return { w, h };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// mp4 / mov dimensions + duration from the moov box (mvhd + the video track's
// tkhd). Best-effort; returns null for non-mp4 (e.g. webm) or anything odd.
function mp4Info(b: Buffer): { w: number; h: number; durationSec: number | null } | null {
  try {
    const findBox = (start: number, end: number, type: string): [number, number] | null => {
      let p = start;
      while (p + 8 <= end) {
        const size = b.readUInt32BE(p);
        const t = b.toString("ascii", p + 4, p + 8);
        if (size < 8) return null; // 0 or 1 (64-bit) size: bail
        if (t === type) return [p + 8, Math.min(p + size, end)];
        p += size;
      }
      return null;
    };
    const moov = findBox(0, b.length, "moov");
    if (!moov) return null;

    let durationSec: number | null = null;
    const mvhd = findBox(moov[0], moov[1], "mvhd");
    if (mvhd) {
      const [s] = mvhd;
      const version = b[s];
      if (version === 1) {
        const timescale = b.readUInt32BE(s + 20);
        const duration = Number(b.readBigUInt64BE(s + 24));
        if (timescale) durationSec = Math.round((duration / timescale) * 10) / 10;
      } else {
        const timescale = b.readUInt32BE(s + 12);
        const duration = b.readUInt32BE(s + 16);
        if (timescale) durationSec = Math.round((duration / timescale) * 10) / 10;
      }
    }

    // Find a track (trak) whose tkhd carries non-zero dimensions (the video).
    let w = 0;
    let h = 0;
    let p = moov[0];
    while (p + 8 <= moov[1]) {
      const size = b.readUInt32BE(p);
      const t = b.toString("ascii", p + 4, p + 8);
      if (size < 8) break;
      if (t === "trak") {
        const tkhd = findBox(p + 8, p + size, "tkhd");
        if (tkhd) {
          const [ts, te] = tkhd;
          const end = te;
          const tw = b.readUInt32BE(end - 8) >> 16;
          const th = b.readUInt32BE(end - 4) >> 16;
          if (tw > 0 && th > 0) { w = tw; h = th; }
          void ts;
        }
      }
      p += size;
    }
    if (w > 0 && h > 0) return { w, h, durationSec };
    if (durationSec != null) return { w: 0, h: 0, durationSec };
  } catch {
    /* ignore */
  }
  return null;
}

function deriveDims(
  bytes: Buffer,
  kind: "video" | "image",
): { width: number | null; height: number | null; durationSec: number | null } {
  if (kind === "image") {
    const d = imageDimensions(bytes);
    return { width: d?.w ?? null, height: d?.h ?? null, durationSec: null };
  }
  const info = mp4Info(bytes);
  return {
    width: info?.w || null,
    height: info?.h || null,
    durationSec: info?.durationSec ?? null,
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'");
}

// Find a <meta> content by og/twitter key, tolerant of attribute order.
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const esc = key.replace(/[:]/g, "\\:");
    const a = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?content=["']([^"']*)["']`,
        "i",
      ),
    );
    if (a?.[1]) return decodeEntities(a[1].trim());
    const b = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${esc}["']`,
        "i",
      ),
    );
    if (b?.[1]) return decodeEntities(b[1].trim());
  }
  return null;
}

// A share page's og:description is usually the SITE's marketing tagline (e.g.
// Higgsfield's "The ultimate AI-powered camera control for creators by
// creators"), not the generation's prompt. Only treat it as a prompt hint if it
// doesn't look like marketing boilerplate; otherwise return null so the prompt
// field stays empty for the user to fill (better than a wrong auto-fill).
const PROMPT_BOILERPLATE =
  /(ai[- ]powered|for creators|the ultimate|all[- ]in[- ]one|sign\s?up|log\s?in|create stunning|generate (videos|images|stunning)|turn (text|your photos|images) into|explore (millions|thousands)|join (millions|thousands)|best (ai|video|image) )/i;

function cleanPromptHint(desc: string | null): string | null {
  if (!desc) return null;
  const d = desc.trim();
  if (d.length < 12) return null;
  if (PROMPT_BOILERPLATE.test(d)) return null;
  return d;
}

function kindFromContentType(ct: string): "video" | "image" | null {
  const c = ct.toLowerCase();
  if (c.startsWith("video/")) return "video";
  if (c.startsWith("image/")) return "image";
  return null;
}

function guessFilename(u: URL, ct: string): string {
  const last = u.pathname.split("/").filter(Boolean).pop() || "";
  if (last && /\.[a-z0-9]{2,4}$/i.test(last)) return last;
  const c = ct.toLowerCase();
  const ext = c.startsWith("video/")
    ? c.includes("webm")
      ? "webm"
      : c.includes("quicktime")
        ? "mov"
        : "mp4"
    : c.includes("png")
      ? "png"
      : c.includes("gif")
        ? "gif"
        : c.includes("webp")
          ? "webp"
          : "jpg";
  return `${last || "clip"}.${ext}`;
}

// Every fetch here is against a user-pasted link, so it MUST be time-bounded: a
// slow or stalled host would otherwise hang the server action (and the import
// modal) indefinitely. The AbortController signal aborts both the connection and
// the body stream, so it also caps a stalled download mid-read.
const PAGE_TIMEOUT_MS = 15000;
const DOWNLOAD_TIMEOUT_MS = 30000;

async function download(
  u: URL,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await safeFetch(u, {
      headers: { "user-agent": BROWSER_UA, accept: "*/*" },
      signal: controller.signal,
    });
    if (!res || !res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len && len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return { bytes: buf, contentType: ct };
  } catch {
    return null; // timeout / network error
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMediaFromUrl(
  raw: string,
): Promise<FetchedMedia | { error: string }> {
  const u = isFetchableUrl(raw.trim());
  if (!u) return { error: "Not a valid public link." };

  // Time-bound the page fetch + its body read (the share page could be a slow
  // SPA). A separate timeout guards the media download below.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  let first: Response | null;
  let firstText = "";
  let firstBuf: Buffer | null = null;
  let ct = "";
  let directKind: "video" | "image" | null = null;
  try {
    first = await safeFetch(u, {
      headers: { "user-agent": BROWSER_UA, accept: "*/*" },
      signal: controller.signal,
    });
    if (!first || !first.ok) return { error: "Could not reach that link (it may be private or slow)." };
    ct = (first.headers.get("content-type") ?? "").toLowerCase();
    directKind = kindFromContentType(ct);
    if (directKind) {
      const len = Number(first.headers.get("content-length") ?? "0");
      if (len && len > MAX_BYTES) return { error: "File is too large to import." };
      firstBuf = Buffer.from(await first.arrayBuffer());
    } else if (ct.includes("html") || ct.includes("xml") || ct === "") {
      firstText = (await first.text()).slice(0, 800_000);
    }
  } catch {
    return { error: "Timed out reaching that link. Try the direct file URL, or check the link." };
  } finally {
    clearTimeout(timer);
  }

  // 1. The link is the media itself.
  if (directKind && firstBuf) {
    if (firstBuf.byteLength === 0) return { error: "The file was empty." };
    if (firstBuf.byteLength > MAX_BYTES) return { error: "File is too large to import." };
    return {
      bytes: firstBuf,
      contentType: ct,
      kind: directKind,
      sourceUrl: u.toString(),
      filename: guessFilename(u, ct),
      ...deriveDims(firstBuf, directKind),
      platform: detectPlatform(u.toString()),
      description: null,
    };
  }

  // 2. A share / watch page: find the underlying media in the page metadata.
  if (firstText) {
    const html = firstText;
    const videoUrl = metaContent(html, [
      "og:video:secure_url",
      "og:video:url",
      "og:video",
      "twitter:player:stream",
    ]);
    const imageUrl = metaContent(html, [
      "og:image:secure_url",
      "og:image:url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]);
    const description = metaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);
    const pick = videoUrl ?? imageUrl;
    if (!pick) {
      return {
        error: "No video or image found on that page. Paste the direct media (.mp4/.png) link instead.",
      };
    }
    let mediaUrl: URL;
    try {
      mediaUrl = new URL(pick, u);
    } catch {
      return { error: "The media link on that page was invalid." };
    }
    const safe = isFetchableUrl(mediaUrl.toString());
    if (!safe) return { error: "The media link on that page was not reachable." };
    const dl = await download(safe);
    if (!dl) return { error: "Could not download the media from that page (it may be too large or slow)." };
    const dlKind =
      kindFromContentType(dl.contentType) ?? (videoUrl ? "video" : "image");
    return {
      bytes: dl.bytes,
      contentType:
        dl.contentType || (dlKind === "video" ? "video/mp4" : "image/jpeg"),
      kind: dlKind,
      sourceUrl: u.toString(),
      filename: guessFilename(safe, dl.contentType || ""),
      ...deriveDims(dl.bytes, dlKind),
      platform: detectPlatform(u.toString()),
      description: cleanPromptHint(description),
    };
  }

  return { error: "That link is not a video or image." };
}
