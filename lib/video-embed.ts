// Parse a pasted video URL (YouTube, Vimeo, Loom, or a direct video file) into an
// embeddable player URL. Pure and client-safe, used by both the paste modal (to
// validate) and the board render (to embed). Returns null for unrecognized links.

export type VideoEmbed = {
  provider: "youtube" | "vimeo" | "loom" | "file";
  embedUrl: string;
  title: string;
};

function yt(id: string): VideoEmbed {
  return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}`, title: "YouTube" };
}

export function videoEmbed(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return yt(id);
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v) return yt(v);
    const m = u.pathname.match(/\/(?:embed|shorts|v|live)\/([^/?#]+)/);
    if (m) return yt(m[1]);
  }

  // Vimeo
  if (host === "vimeo.com") {
    const m = u.pathname.match(/\/(\d+)/);
    if (m) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}`, title: "Vimeo" };
  }
  if (host === "player.vimeo.com") {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}`, title: "Vimeo" };
  }

  // Loom
  if (host === "loom.com") {
    const m = u.pathname.match(/\/(?:share|embed)\/([^/?#]+)/);
    if (m) return { provider: "loom", embedUrl: `https://www.loom.com/embed/${m[1]}`, title: "Loom" };
  }

  // Direct video file
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u.pathname)) {
    return { provider: "file", embedUrl: u.toString(), title: "Video" };
  }

  return null;
}
