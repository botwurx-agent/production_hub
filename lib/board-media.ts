// Image / video cards store display settings in board_items.text: the media fit
// (cover / contain) and a rich-text caption (HTML). Backward compatible with the
// earlier plain "cover" / "contain" value.

export type MediaMeta = { fit: "cover" | "contain"; caption: string };

export function parseMediaMeta(text: string | null | undefined): MediaMeta {
  if (!text) return { fit: "cover", caption: "" };
  if (text === "contain") return { fit: "contain", caption: "" };
  if (text === "cover") return { fit: "cover", caption: "" };
  try {
    const o = JSON.parse(text);
    if (o && typeof o === "object") {
      return {
        fit: o.fit === "contain" ? "contain" : "cover",
        caption: typeof o.caption === "string" ? o.caption : "",
      };
    }
  } catch {
    /* not JSON */
  }
  return { fit: "cover", caption: "" };
}

export function serializeMediaMeta(m: MediaMeta): string {
  // Keep the legacy plain value when there's no caption, so old readers stay happy.
  if (!m.caption) return m.fit === "contain" ? "contain" : "cover";
  return JSON.stringify({ fit: m.fit, caption: m.caption });
}
