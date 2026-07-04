"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileSize, shortDate } from "@/lib/format";
import { viewerKind } from "@/lib/file-kind";
import { searchDrive, importDriveFile } from "@/app/(app)/projects/[id]/drive-actions";
import type { DriveFile } from "@/lib/googledrive";

function DriveGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.4 3.5h7.2l6.4 11.1-3.6 6.2H5.6L2 14.6 8.4 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M2 14.6h20M8.4 3.5l7.2 22M15.6 3.5 8.4 25.5" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
    </svg>
  );
}

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

function FileCard({
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
  const [imgFailed, setImgFailed] = useState(false);
  const [busy, start] = useTransition();

  const kind = file.isGoogleDoc ? "office" : viewerKind(file.mimeType, file.name);
  const showThumb = file.hasThumbnail && file.thumbnailLink && !imgFailed;

  function add() {
    setErr(null);
    start(async () => {
      const res = await importDriveFile(
        projectId,
        file.id,
        file.name,
        file.mimeType
      );
      if (res?.error) setErr(res.error);
      else {
        setDone(true);
        onDone();
      }
    });
  }

  const meta = [
    file.isGoogleDoc ? "Google Doc" : file.size ? fileSize(file.size) : null,
    file.modifiedTime ? shortDate(file.modifiedTime) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
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

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-text" title={file.name}>
            {file.name}
          </div>
          <div className="mt-0.5 text-xs text-text-faint">{meta.join("  ·  ")}</div>
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

export function DriveImportButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DriveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function run(q: string) {
    setError(null);
    start(async () => {
      const res = await searchDrive(q);
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else setResults(res.files);
    });
  }

  useEffect(() => {
    if (open) {
      setQuery("");
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <DriveGlyph /> Import from Drive
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-bold text-text">
                Import from Google Drive
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-[9px] text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-border px-5 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(query);
                }}
                className="flex gap-2"
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your Drive by file name"
                  autoFocus
                />
                <Button type="submit" disabled={busy}>
                  {busy ? "..." : "Search"}
                </Button>
              </form>
              {error && (
                <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                  {error}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {results === null || busy ? (
                <p className="py-10 text-center text-sm text-text-faint">
                  {busy ? "Searching your Drive..." : ""}
                </p>
              ) : results.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-faint">
                  No matching files.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {results.map((f) => (
                    <FileCard
                      key={f.id}
                      projectId={projectId}
                      file={f}
                      onDone={() => router.refresh()}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border px-5 py-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
