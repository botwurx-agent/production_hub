"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { fileSize, shortDate } from "@/lib/format";
import { viewerKind, officeEmbedUrl, officeViewUrl } from "@/lib/file-kind";
import { ScrubVideo } from "@/components/review/video-player";
import { toast } from "@/components/ui/toast";
import { Modal, useModalRoomy } from "@/components/ui/modal";
import type { VersionRow } from "@/components/projects/asset-types";

export { viewerKind };

function FileGlyph() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
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
  onRename,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  version: VersionRow;
  // Both optional: the viewer stays presentational where management is not
  // offered. Each returns an error message, or null on success.
  onRename?: (name: string) => Promise<string | null>;
  onDelete?: () => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset the local edit state whenever a different file is opened.
    setDraft(name);
    setEditing(false);
    setConfirming(false);
  }, [name, version.id]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function saveName() {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    start(async () => {
      const err = await onRename?.(next);
      if (err) {
        toast(err, "error");
        setDraft(name);
      }
      setEditing(false);
    });
  }

  function doDelete() {
    start(async () => {
      const err = await onDelete?.();
      if (err) {
        toast(err, "error");
        setConfirming(false);
        return;
      }
      onClose();
    });
  }

  if (!open) return null;

  const link = version.signedUrl ?? version.url;
  const kind = viewerKind(
    version.mime_type,
    version.storage_path ?? version.url ?? name,
  );
  // For Office files the browser can't display the raw bytes, so "Open in new
  // tab" points at the Office web viewer instead of downloading.
  const openLink = kind === "office" && link ? officeViewUrl(link) : link;

  const heading = (
    <div className="min-w-0">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveName();
            }
            if (e.key === "Escape") {
              // Cancel the rename. Stopped here so it does not also
              // bubble to the window's own Escape-to-close.
              e.stopPropagation();
              setEditing(false);
              setDraft(name);
            }
          }}
          aria-label="File name"
          className="w-full rounded-[8px] border border-accent bg-bg px-2 py-1 font-display text-base font-bold text-text outline-none"
        />
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate font-display text-base font-bold text-text">
            {name}
          </h2>
          {onRename && (
            <button
              onClick={() => setEditing(true)}
              aria-label="Rename file"
              title="Rename"
              className="shrink-0 rounded-[7px] p-1 text-text-faint transition hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-text-faint">
        v{version.version_number}
        {version.size_bytes ? `  ·  ${fileSize(version.size_bytes)}` : ""}
        {version.created_at ? `  ·  ${shortDate(version.created_at)}` : ""}
      </p>
    </div>
  );

  const actions = (
    <>
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
      {onDelete &&
        (confirming ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text-muted">
              Delete file?
            </span>
            <button
              onClick={doDelete}
              disabled={busy}
              className="rounded-[9px] bg-red px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-[9px] px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title="Delete this file and all its versions"
            className="rounded-[9px] px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-red-bg hover:text-red"
          >
            Delete
          </button>
        ))}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Names the dialog; the visible heading is the editable one above.
      title={name}
      titleNode={heading}
      actions={actions}
      size="xl"
      // Remembered per browser, so a producer who works expanded does not have
      // to expand it again on the next file.
      id="asset-viewer"
      bodyClassName="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-surface-2/40 p-4"
    >
      <Stage kind={kind} link={link} name={name} />
    </Modal>
  );
}

/**
 * The file itself.
 *
 * Split out for one reason: it reads whether the window has been given more
 * room, and grows the media to match. Expanding a viewer has to make the
 * DOCUMENT bigger, not the margins around it, which is the same rule the
 * review canvases follow.
 */
function Stage({
  kind,
  link,
  name,
}: {
  kind: ReturnType<typeof viewerKind>;
  link: string | null;
  name: string;
}) {
  const roomy = useModalRoomy();
  // Chrome above and below the stage is fixed, so the media is sized against
  // the viewport rather than against a parent whose height is content-driven.
  const tall = roomy ? "h-[calc(100dvh-10rem)]" : "h-[78dvh]";
  const capped = roomy ? "max-h-[calc(100dvh-10rem)]" : "max-h-[78dvh]";

  return (
    <>
      {!link ? (
        <p className="text-sm text-text-faint">
          This version has no file attached.
        </p>
      ) : kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link}
          alt={name}
          className={`${capped} max-w-full rounded-[10px] object-contain`}
        />
      ) : kind === "video" ? (
        <div className={`w-full ${roomy ? "max-w-5xl" : "max-w-3xl"}`}>
          <ScrubVideo
            src={link}
            maxHeightClass={
              roomy ? "max-h-[calc(100dvh-13rem)]" : "max-h-[72dvh]"
            }
          />
        </div>
      ) : kind === "audio" ? (
        <audio src={link} controls className="w-full max-w-lg" />
      ) : kind === "pdf" ? (
        <iframe
          src={link}
          title={name}
          className={`${tall} w-full rounded-[10px] border border-border bg-white`}
        />
      ) : kind === "office" ? (
        <iframe
          src={officeEmbedUrl(link)}
          title={name}
          className={`${tall} w-full rounded-[10px] border border-border bg-white`}
        />
      ) : kind === "text" ? (
        <iframe
          src={link}
          title={name}
          className={`${tall} w-full rounded-[10px] border border-border bg-white`}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-text-muted">
          <FileGlyph />
          <p className="text-sm">No inline preview for this file type.</p>
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
    </>
  );
}
