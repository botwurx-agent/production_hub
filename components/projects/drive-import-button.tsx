"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileSize, shortDate } from "@/lib/format";
import { searchDrive, importDriveFile } from "@/app/(app)/projects/[id]/drive-actions";
import type { DriveFile } from "@/lib/googledrive";

// A small Drive glyph (the triangle mark), tinted to the current text color.
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

function FileResult({
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
    <div className="flex items-start justify-between gap-3 rounded-[12px] border border-border p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-text">
          {file.name}
        </div>
        <div className="text-xs text-text-faint">{meta.join("  ·  ")}</div>
        {err && <div className="mt-1 text-xs font-medium text-red">{err}</div>}
      </div>
      <Button
        size="sm"
        variant={done ? "secondary" : "primary"}
        disabled={done || busy}
        onClick={add}
      >
        {done ? "Added" : busy ? "..." : "Add to assets"}
      </Button>
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

  // Show recent files on open so they can browse or type to filter.
  useEffect(() => {
    if (open) {
      setQuery("");
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <DriveGlyph /> Import from Drive
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Import from Google Drive"
      >
        <div className="space-y-4">
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
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}

          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {results === null ? null : results.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-faint">
                {busy ? "Searching..." : "No matching files."}
              </p>
            ) : (
              results.map((f) => (
                <FileResult
                  key={f.id}
                  projectId={projectId}
                  file={f}
                  onDone={() => router.refresh()}
                />
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
