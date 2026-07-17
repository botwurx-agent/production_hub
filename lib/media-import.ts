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
};

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

async function download(
  u: URL,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await safeFetch(u, {
    headers: { "user-agent": BROWSER_UA, accept: "*/*" },
  });
  if (!res || !res.ok) return null;
  const ct = res.headers.get("content-type") ?? "";
  const len = Number(res.headers.get("content-length") ?? "0");
  if (len && len > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
  return { bytes: buf, contentType: ct };
}

export async function fetchMediaFromUrl(
  raw: string,
): Promise<FetchedMedia | { error: string }> {
  const u = isFetchableUrl(raw.trim());
  if (!u) return { error: "Not a valid public link." };

  const first = await safeFetch(u, {
    headers: { "user-agent": BROWSER_UA, accept: "*/*" },
  });
  if (!first || !first.ok) return { error: "Could not reach that link." };
  const ct = (first.headers.get("content-type") ?? "").toLowerCase();
  const directKind = kindFromContentType(ct);

  // 1. The link is the media itself.
  if (directKind) {
    const len = Number(first.headers.get("content-length") ?? "0");
    if (len && len > MAX_BYTES) return { error: "File is too large to import." };
    const buf = Buffer.from(await first.arrayBuffer());
    if (buf.byteLength === 0) return { error: "The file was empty." };
    if (buf.byteLength > MAX_BYTES) return { error: "File is too large to import." };
    return {
      bytes: buf,
      contentType: ct,
      kind: directKind,
      sourceUrl: u.toString(),
      filename: guessFilename(u, ct),
    };
  }

  // 2. A share / watch page: find the underlying media in the page metadata.
  if (ct.includes("html") || ct.includes("xml") || ct === "") {
    const html = (await first.text()).slice(0, 800_000);
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
    const pick = videoUrl ?? imageUrl;
    if (!pick) {
      return {
        error: "No video or image found on that page. Paste the direct media link.",
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
    if (!dl) return { error: "Could not download the media from that page." };
    const dlKind =
      kindFromContentType(dl.contentType) ?? (videoUrl ? "video" : "image");
    return {
      bytes: dl.bytes,
      contentType:
        dl.contentType || (dlKind === "video" ? "video/mp4" : "image/jpeg"),
      kind: dlKind,
      sourceUrl: u.toString(),
      filename: guessFilename(safe, dl.contentType || ""),
    };
  }

  return { error: "That link is not a video or image." };
}
