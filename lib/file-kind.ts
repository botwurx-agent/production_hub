// Shared (server + client safe) helpers for deciding how to preview a file and
// for building Office web-viewer URLs. Used by the in-app asset viewer and the
// client review portal.

export type ViewerKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "office"
  | "text"
  | "other";

// Office (Word/Excel/PowerPoint) mime types, incl. the legacy .doc/.xls/.ppt.
const OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

// Extension fallback, since imported/uploaded files often arrive with a missing
// or generic mime type (e.g. application/octet-stream).
const EXT_KIND: Record<string, ViewerKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  bmp: "image", svg: "image", avif: "image", heic: "image", heif: "image", tiff: "image",
  mp4: "video", mov: "video", webm: "video", m4v: "video", avi: "video", mkv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio", ogg: "audio", flac: "audio",
  pdf: "pdf",
  doc: "office", docx: "office", xls: "office", xlsx: "office",
  ppt: "office", pptx: "office",
  txt: "text", xml: "text", json: "text", csv: "text", md: "text",
  log: "text", yml: "text", yaml: "text", html: "text", htm: "text", rtf: "text",
};

export function extOf(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const clean = c.split("?")[0].split("#")[0];
    const dot = clean.lastIndexOf(".");
    if (dot >= 0 && dot < clean.length - 1) return clean.slice(dot + 1).toLowerCase();
  }
  return "";
}

// Decides how to preview a file, preferring a specific mime type and falling
// back to the file extension (from the path, url, or name) when the mime is
// missing or generic.
export function viewerKind(
  mime: string | null | undefined,
  hint?: string | null
): ViewerKind {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (OFFICE_MIMES.has(m)) return "office";
  if (m === "application/xml" || m === "application/json") return "text";
  if (m.startsWith("text/")) return "text";
  const byExt = EXT_KIND[extOf(hint)];
  if (byExt) return byExt;
  return "other";
}

// Microsoft's hosted Office viewer renders Word/Excel/PowerPoint from a
// publicly reachable URL. `embed` is for an inline iframe; the full-page view
// is for opening in a new tab.
export function officeEmbedUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}
export function officeViewUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
}
