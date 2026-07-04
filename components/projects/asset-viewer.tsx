"use client";

import { useEffect } from "react";
import { fileSize, shortDate } from "@/lib/format";
import type { VersionRow } from "@/components/projects/asset-types";

type ViewerKind =
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

export function viewerKind(mime: string | null | undefined): ViewerKind {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (OFFICE_MIMES.has(m)) return "office";
  if (m.startsWith("text/")) return "text";
  return "other";
}

// Microsoft's hosted Office viewer renders Word/Excel/PowerPoint from a
// publicly reachable URL (our Supabase signed URLs qualify while they last).
// `embed` is for the inline iframe; the full-page view is for a new tab.
function officeEmbedUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}
function officeViewUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function FileGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// Full-size viewer for an asset version. Renders the file inline when the
// browser can (image, video, audio, PDF), and always offers open-in-new-tab
// and download. Opened by clicking an asset's preview.
export function AssetViewer({
  open,
  onClose,
  name,
  version,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  version: VersionRow;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const link = version.signedUrl ?? version.url;
  const kind = viewerKind(version.mime_type);
  // For Office files the browser can't display the raw bytes, so "Open in new
  // tab" points at the Office web viewer instead of downloading.
  const openLink =
    kind === "office" && link ? officeViewUrl(link) : link;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-text">
              {name}
            </h2>
            <p className="text-xs text-text-faint">
              v{version.version_number}
              {version.size_bytes ? `  ·  ${fileSize(version.size_bytes)}` : ""}
              {version.created_at ? `  ·  ${shortDate(version.created_at)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {link && (
              <>
                <a
                  href={openLink ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[9px] bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-fg"
                >
                  Open in new tab
                </a>
                <a
                  href={link}
                  download={name}
                  className="rounded-[9px] px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  Download
                </a>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-surface-2/40 p-4">
          {!link ? (
            <p className="text-sm text-text-faint">
              This version has no file attached.
            </p>
          ) : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={link}
              alt={name}
              className="max-h-[78vh] max-w-full rounded-[10px] object-contain"
            />
          ) : kind === "video" ? (
            <video
              src={link}
              controls
              autoPlay
              className="max-h-[78vh] max-w-full rounded-[10px]"
            />
          ) : kind === "audio" ? (
            <audio src={link} controls className="w-full max-w-lg" />
          ) : kind === "pdf" ? (
            <iframe
              src={link}
              title={name}
              className="h-[78vh] w-full rounded-[10px] border border-border bg-white"
            />
          ) : kind === "office" ? (
            <iframe
              src={officeEmbedUrl(link)}
              title={name}
              className="h-[78vh] w-full rounded-[10px] border border-border bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-text-muted">
              <FileGlyph />
              <p className="text-sm">
                No inline preview for this file type.
              </p>
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="rounded-[9px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
              >
                Open {name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
