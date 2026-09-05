"use client";

import { useRef, useState } from "react";

/**
 * Drop files anywhere on a surface.
 *
 * Extracted from the assets dropzone, which had the mechanics right and buried
 * them inside asset-specific staging. Every page that takes a document (an
 * agreement, a permit, a vendor invoice, a release) wants the same behaviour,
 * and having a button and no drop target on a page whose whole job is
 * receiving a file is the kind of small friction that makes people keep using
 * the folder on their desktop instead.
 *
 * WHAT IT OWNS: the drag lifecycle, the overlay, the size check, and an
 * optional click-to-browse. WHAT IT DOES NOT OWN: what happens to the files.
 * The caller decides, because filing a SOW, a permit and an invoice are three
 * different jobs that happen to start the same way.
 *
 * DEPTH COUNTING, not a boolean. `dragenter` and `dragleave` fire for every
 * child element the cursor crosses, so a plain flag flickers the overlay off
 * the moment the pointer moves over a card inside the zone. Counting enters
 * against leaves is what makes it steady.
 */

function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  maxBytes,
  onTooLarge,
  /** Overlay wording, e.g. "Drop to add an agreement". */
  label = "Drop files to upload",
  /** Renders a dashed browse strip above the children. */
  browse,
  disabled = false,
  className = "",
  children,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxBytes?: number;
  onTooLarge?: (files: File[]) => void;
  label?: string;
  browse?: { text: string } | false;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function take(list: FileList | null) {
    // Copy BEFORE the input is cleared: a FileList is a live view of the
    // selection, so resetting value first empties it. The email composer
    // shipped that bug once and it is easy to reintroduce.
    const all = Array.from(list ?? []);
    if (all.length === 0) return;
    const files = multiple ? all : all.slice(0, 1);
    if (maxBytes) {
      const over = files.filter((f) => f.size > maxBytes);
      const ok = files.filter((f) => f.size <= maxBytes);
      if (over.length > 0) onTooLarge?.(over);
      if (ok.length === 0) return;
      onFiles(ok);
      return;
    }
    onFiles(files);
  }

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => {
        if (!disabled && hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setActive(false);
        take(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {browse && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-[12px] border-2 border-dashed border-border bg-surface-2/40 px-4 py-4 text-sm text-text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent disabled:opacity-60"
        >
          <UploadIcon />
          <span className="font-semibold">{browse.text}</span>
        </button>
      )}

      {children}

      {active && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[16px] border-2 border-dashed border-accent bg-accent-soft/50 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-pill bg-surface px-4 py-2 text-sm font-semibold text-accent shadow">
            <UploadIcon />
            {label}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
