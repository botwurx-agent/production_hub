import "server-only";

// Minimal link "unfurl": fetch a URL's HTML and pull Open Graph / Twitter card
// metadata (title, description, preview image) so a pasted link becomes a visual
// card, like Milanote. Best-effort and defensive: any failure returns empty
// metadata rather than throwing.

export type LinkMeta = {
  title: string | null;
  description: string | null;
  image: string | null; // absolute URL
  siteName: string | null;
};

// A real browser UA + language so sites (Pinterest, etc.) serve their SSR HTML
// with Open Graph tags instead of a bot wall. Reused for the image download.
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// The Facebook link-preview crawler. Many sites (Pinterest, news, shops)
// whitelist this UA to serve rich Open Graph data even when they wall browsers.
export const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

// Reject non-public / non-http(s) hosts to limit SSRF from user-pasted URLs.
export function isFetchableUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  ) {
    return null;
  }
  return u;
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

// Find a <meta> content by og/twitter/name key, tolerant of attribute order.
function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const esc = key.replace(/[:]/g, "\\:");
    const a = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?content=["']([^"']*)["']`,
        "i"
      )
    );
    if (a?.[1]) return decodeEntities(a[1].trim());
    const b = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${esc}["']`,
        "i"
      )
    );
    if (b?.[1]) return decodeEntities(b[1].trim());
  }
  return null;
}

async function tryUnfurl(u: URL, ua: string): Promise<LinkMeta> {
  const empty: LinkMeta = { title: null, description: null, image: null, siteName: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": ua,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) return empty;
    if (ct && !ct.includes("html") && !ct.includes("xml")) return empty;
    const html = (await res.text()).slice(0, 500_000);

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const title =
      metaContent(html, ["og:title", "twitter:title"]) ??
      (titleTag ? decodeEntities(titleTag.trim()) : null);
    const description = metaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);
    const siteName = metaContent(html, ["og:site_name"]);
    const rawImg =
      metaContent(html, [
        "og:image:secure_url",
        "og:image:url",
        "og:image",
        "twitter:image",
        "twitter:image:src",
        "image",
      ]) ??
      // <link rel="image_src" href="..."> fallback.
      html.match(/<link[^>]+rel=["']image_src["'][^>]*?href=["']([^"']+)["']/i)?.[1] ??
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]*?rel=["']image_src["']/i)?.[1] ??
      null;
    let image: string | null = null;
    if (rawImg) {
      try {
        image = new URL(rawImg, u).toString();
      } catch {
        image = null;
      }
    }
    return { title, description, image, siteName };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

export async function unfurl(u: URL): Promise<LinkMeta> {
  // Browser first (best for most sites and image CDNs); if it comes back empty
  // (a bot wall), retry as the Facebook crawler, which many sites whitelist for
  // link previews.
  const first = await tryUnfurl(u, BROWSER_UA);
  if (first.title || first.image) return first;
  return tryUnfurl(u, CRAWLER_UA);
}
