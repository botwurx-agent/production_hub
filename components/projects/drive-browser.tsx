"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileSize, shortDate } from "@/lib/format";
import { viewerKind } from "@/lib/file-kind";
import { browseDrive, importDriveFile } from "@/app/(app)/projects/[id]/drive-actions";
import type { DriveFile } from "@/lib/googledrive";

export type PickedDriveFile = { id: string; name: string; mimeType: string };

type Crumb = { id: string; name: string };
const ROOT: Crumb = { id: "root", name: "My Drive" };

const KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  office: "Doc",
  text: "Text",
  other: "File",
};

function thumbUrl(link: string) {
  return `/api/attachments/drive?url=${encodeURIComponent(link)}`;
}

function FolderCard({ file, onOpen }: { file: DriveFile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-border bg-surface p-4 text-center shadow-sm transition hover:-translate-y-px hover:border-border-strong hover:shadow"
    >
      <span
        className="grid h-12 w-12 place-items-center rounded-[12px]"
        style={{ backgroundColor: "var(--h-yellow-bg)", color: "var(--h-yellow)" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </span>
      <span className="line-clamp-2 text-sm font-semibold text-text" title={file.name}>
        {file.name}
      </span>
    </button>
  );
}

function Thumb({ file }: { file: DriveFile }) {
  const [imgFailed, setImgFailed] = useState(false);
  const kind = file.isGoogleDoc ? "office" : viewerKind(file.mimeType, file.name);
  const showThumb = file.hasThumbnail && file.thumbnailLink && !imgFailed;
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60">
      {showThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(file.thumbnailLink!)}
          alt={file.name}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="flex flex-col items-center gap-1.5 text-text-muted">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="text-xs font-bold">{KIND_LABEL[kind] ?? "File"}</span>
        </span>
      )}
    </div>
  );
}

function meta(file: DriveFile) {
  return [
    file.isGoogleDoc ? "Google Doc" : file.size ? fileSize(file.size) : null,
    file.modifiedTime ? shortDate(file.modifiedTime) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
}

// Import a Drive file straight into the project's assets.
function ImportFileCard({
  projectId,
  file,
  onDone,
}: {
  projectId: string;
  file: DriveFile;
  onDone: () => void;
}) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function add() {
    setErr(null);
    start(async () => {
      const res = await importDriveFile(projectId, file.id, file.name, file.mimeType);
      if (res?.error) setErr(res.error);
      else {
        setDone(true);
        onDone();
      }
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      <Thumb file={file} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-text" title={file.name}>
            {file.name}
          </div>
          <div className="mt-0.5 text-xs text-text-faint">{meta(file)}</div>
        </div>
        {err && <div className="text-xs font-medium text-red">{err}</div>}
        <Button
          size="sm"
          variant={done ? "secondary" : "primary"}
          disabled={done || busy}
          onClick={add}
          className="mt-auto w-full"
        >
          {done ? "Added" : busy ? "Adding..." : "Add to assets"}
        </Button>
      </div>
    </div>
  );
}

// Toggle a Drive file into a selection (e.g. to attach to an email).
function SelectFileCard({
  file,
  selected,
  onToggle,
}: {
  file: DriveFile;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
      <Thumb file={file} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-text" title={file.name}>
            {file.name}
          </div>
          <div className="mt-0.5 text-xs text-text-faint">{meta(file)}</div>
        </div>
        <Button
          size="sm"
          variant={selected ? "secondary" : "primary"}
          onClick={onToggle}
          className="mt-auto w-full"
        >
          {selected ? "Attached ✓" : "Attach"}
        </Button>
      </div>
    </div>
  );
}

// Browsable Google Drive picker. In "import" mode files import into the project's
// assets; in "select" mode files toggle into an external selection.
export function DrivePickerModal({
  open,
  onClose,
  mode,
  projectId,
  selectedIds,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  mode: "import" | "select";
  projectId?: string;
  selectedIds?: Set<string>;
  onToggle?: (f: PickedDriveFile) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [crumbs, setCrumbs] = useState<Crumb[]>([ROOT]);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // Portal target: only available after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentFolder = crumbs[crumbs.length - 1];

  function load(folderId: string, q: string) {
    setError(null);
    start(async () => {
      const res = await browseDrive({ folderId, query: q });
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else setResults(res.files);
    });
  }

  function openFolder(file: DriveFile) {
    const next = [...crumbs, { id: file.id, name: file.name }];
    setCrumbs(next);
    setQuery("");
    setSearching(false);
    load(file.id, "");
  }

  function goToCrumb(index: number) {
    const next = crumbs.slice(0, index + 1);
    setCrumbs(next);
    setQuery("");
    setSearching(false);
    load(next[next.length - 1].id, "");
  }

  function doSearch() {
    const q = query.trim();
    if (!q) {
      setSearching(false);
      load(currentFolder.id, "");
      return;
    }
    setSearching(true);
    load(currentFolder.id, q);
  }

  function clearSearch() {
    setQuery("");
    setSearching(false);
    load(currentFolder.id, "");
  }

  useEffect(() => {
    if (open) {
      setQuery("");
      setSearching(false);
      setCrumbs([ROOT]);
      load(ROOT.id, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  if (!open || !mounted) return null;

  const folders = (results ?? []).filter((f) => f.isFolder);
  const files = (results ?? []).filter((f) => !f.isFolder);
  const selectedCount = selectedIds?.size ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-bold text-text">
            {mode === "import" ? "Import from Google Drive" : "Attach from Google Drive"}
          </h2>
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

        <div className="space-y-2 border-b border-border px-5 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your Drive by file name"
            />
            <Button type="submit" disabled={busy}>
              {busy ? "..." : "Search"}
            </Button>
          </form>

          {searching ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Search results across your Drive</span>
              <button onClick={clearSearch} className="font-semibold text-accent hover:underline">
                Clear
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-text-faint">/</span>}
                  <button
                    onClick={() => goToCrumb(i)}
                    disabled={i === crumbs.length - 1}
                    className={
                      i === crumbs.length - 1
                        ? "font-semibold text-text"
                        : "font-semibold text-accent hover:underline"
                    }
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {results === null || busy ? (
            <p className="py-10 text-center text-sm text-text-faint">
              {busy ? "Loading your Drive..." : ""}
            </p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-faint">
              {searching ? "No matching files." : "This folder is empty."}
            </p>
          ) : (
            <div className="space-y-4">
              {folders.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {folders.map((f) => (
                    <FolderCard key={f.id} file={f} onOpen={() => openFolder(f)} />
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {files.map((f) =>
                    mode === "import" ? (
                      <ImportFileCard
                        key={f.id}
                        projectId={projectId!}
                        file={f}
                        onDone={() => router.refresh()}
                      />
                    ) : (
                      <SelectFileCard
                        key={f.id}
                        file={f}
                        selected={selectedIds?.has(f.id) ?? false}
                        onToggle={() =>
                          onToggle?.({
                            id: f.id,
                            name: f.name,
                            mimeType: f.mimeType,
                          })
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-text-faint">
            {mode === "select" && selectedCount > 0
              ? `${selectedCount} selected`
              : ""}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
