"use client";

import { useState, type ReactNode } from "react";
import { fileSize } from "@/lib/format";
import { viewerKind } from "@/lib/file-kind";

const KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  office: "Doc",
  text: "Text",
  other: "File",
};

// A visual card for an attachment (email/Slack): a thumbnail (image preview or a
// typed placeholder), the file name and size, a Download link, and an import
// action passed in as children.
export function AttachmentCard({
  name,
  mime,
  size,
  previewUrl,
  downloadUrl,
  children,
}: {
  name: string;
  mime: string;
  size?: number | null;
  previewUrl?: string | null;
  downloadUrl: string;
  children?: ReactNode;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const kind = viewerKind(mime, name);
  const showThumb = Boolean(previewUrl) && kind === "image" && !imgFailed;

  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-surface">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60">
        {showThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl!}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-muted">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span className="text-[11px] font-bold">
              {KIND_LABEL[kind] ?? "File"}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="min-w-0">
          <div
            className="line-clamp-2 text-xs font-semibold text-text"
            title={name}
          >
            {name}
          </div>
          {size ? (
            <div className="mt-0.5 text-[11px] text-text-faint">
              {fileSize(size)}
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <a
            href={downloadUrl}
            download={name}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            Download
          </a>
          {children}
        </div>
      </div>
    </div>
  );
}
