"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drop a file anywhere on the page.
 *
 * FIRST VERSION WAS WRONG IN A WAY WORTH RECORDING. It listened on the element
 * it wrapped, which on the agreements page is a list inside a card. Aim a
 * little wide and the drop lands on the page instead, where the browser's own
 * default takes over and OPENS THE FILE IN A NEW TAB. So the feature appeared
 * broken, and worse, missing threw you out of the app. A drop target you have
 * to aim at is not a drop target.
 *
 * So the listeners are on the WINDOW while a zone is mounted, and the whole
 * viewport is the target. A file dragged anywhere over the page is caught, and
 * a file dropped anywhere is taken. Nothing can reach the browser default.
 *
 * ONE ZONE WINS, via a module-level stack: the most recently mounted takes the
 * drop, so a modal with its own dropzone over a page with one does not fire
 * both. Pages pass `disabled` while their own modal is open, for the same
 * reason: dropping onto an open form should not also start a second one.
 *
 * FILE DRAGS ONLY. Internal HTML5 drags (the board tool rail, call sheet block
 * reordering) carry custom mime types, so they never match and are untouched.
 */

type Zone = {
  disabled: boolean;
  take: (files: FileList | null) => void;
  arm: (on: boolean) => void;
};

const stack: Zone[] = [];

function topZone(): Zone | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i].disabled) return stack[i];
  }
  return null;
}

function hasFiles(dt: DataTransfer | null): boolean {
  return Array.from(dt?.types ?? []).includes("Files");
}

/** Installed once, however many zones are mounted. */
let installed = 0;
let depth = 0;
function install() {
  if (installed++ > 0) return;
  window.addEventListener("dragenter", onEnter);
  window.addEventListener("dragover", onOver);
  window.addEventListener("dragleave", onLeave);
  window.addEventListener("drop", onDrop);
}
function uninstall() {
  if (--installed > 0) return;
  depth = 0;
  window.removeEventListener("dragenter", onEnter);
  window.removeEventListener("dragover", onOver);
  window.removeEventListener("dragleave", onLeave);
  window.removeEventListener("drop", onDrop);
}
function onEnter(e: DragEvent) {
  if (!hasFiles(e.dataTransfer) || stack.length === 0) return;
  e.preventDefault();
  depth += 1;
  topZone()?.arm(true);
}
function onOver(e: DragEvent) {
  // WITHOUT THIS the browser navigates to the file on drop, which is the bug
  // this whole rewrite exists for. preventDefault on dragover is what makes a
  // page a valid drop target at all, and it is done for a DISABLED zone too:
  // being thrown out of the app is worse than a drop that does nothing.
  if (!hasFiles(e.dataTransfer) || stack.length === 0) return;
  e.preventDefault();
}
function onLeave(e: DragEvent) {
  if (!hasFiles(e.dataTransfer)) return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) stack.forEach((z) => z.arm(false));
}
function onDrop(e: DragEvent) {
  if (!hasFiles(e.dataTransfer) || stack.length === 0) return;
  e.preventDefault();
  depth = 0;
  stack.forEach((x) => x.arm(false));
  // Only an enabled zone receives it; a drop while a form is open is inert.
  topZone()?.take(e.dataTransfer?.files ?? null);
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  maxBytes,
  onTooLarge,
  /** Overlay wording, e.g. "Drop to add an agreement". */
  label = "Drop files to upload",
  /** The persistent dashed strip. Pass false only where one already exists. */
  browse = { text: "Drag a file here, or click to browse" },
  hint,
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
  /** Small line under the strip, e.g. "PDF or an image, up to 4MB". */
  hint?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Held in a ref so the window listeners always see the CURRENT handler
  // without re-registering on every render.
  const live = useRef({ onFiles, maxBytes, onTooLarge, multiple, disabled });
  live.current = { onFiles, maxBytes, onTooLarge, multiple, disabled };

  function take(list: FileList | null) {
    // Copy BEFORE anything clears the input: a FileList is a live view of the
    // selection, so clearing first empties it.
    const all = Array.from(list ?? []);
    if (all.length === 0) return;
    const { multiple: m, maxBytes: cap, onTooLarge: tooBig, onFiles: cb } = live.current;
    const files = m ? all : all.slice(0, 1);
    if (cap) {
      const over = files.filter((f) => f.size > cap);
      const ok = files.filter((f) => f.size <= cap);
      if (over.length > 0) tooBig?.(over);
      if (ok.length === 0) return;
      cb(ok);
      return;
    }
    cb(files);
  }

  useEffect(() => {
    const zone: Zone = {
      get disabled() {
        return live.current.disabled;
      },
      take,
      arm: setArmed,
    };
    stack.push(zone);
    install();
    return () => {
      const i = stack.indexOf(zone);
      if (i >= 0) stack.splice(i, 1);
      uninstall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className}>
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

      {/* SAYS IT IS POSSIBLE BEFORE YOU TRY. Nothing on the page indicated a
          file could be dropped, so nobody would think to. */}
      {browse && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mb-4 flex w-full flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-border bg-surface-2/40 px-4 py-5 text-sm text-text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5 font-semibold">
            <UploadIcon />
            {browse.text}
          </span>
          {hint && <span className="text-xs text-text-faint">{hint}</span>}
        </button>
      )}

      {children}

      {/* FIXED, not absolute: the target is the whole viewport now, so the
          confirmation has to be too, or it would point at the wrong place. */}
      {armed && !disabled && (
        <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-accent-soft/40 backdrop-blur-[2px]">
          <div className="flex items-center gap-2.5 rounded-[14px] border-2 border-dashed border-accent bg-surface px-6 py-4 text-base font-bold text-accent shadow-lg">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
