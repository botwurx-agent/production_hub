"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAsset, addVersion } from "@/app/(app)/projects/[id]/actions";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { findVersionParent } from "@/lib/asset-name";
import {
  VersionSuggestion,
} from "@/components/projects/version-suggestion";
import type { ExistingAsset } from "@/components/projects/add-asset-button";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ASSET_TYPE_LABEL } from "@/lib/status";
import { fileSize } from "@/lib/format";

// Assets can be large (video cuts), so allow more than the board's image cap.
const MAX_MB = 200;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const TYPES = ["image", "video", "storyboard", "reference", "cut", "other"];

function assetType(f: File): string {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  return "other";
}

// A dropped file staged for confirmation: name / type / version are editable
// before anything is uploaded.
type Staged = {
  file: File;
  name: string;
  type: string;
  versionNumber: string;
  // Set when the dropped name looks like a new version of an existing file and
  // the suggestion was accepted; cleared plus ignored when dismissed.
  versionOf: ExistingAsset | null;
  ignored: boolean;
};
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim() || name || "Untitled";
}
function hasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

// Wraps the assets card so files dropped anywhere on it upload as new assets
// (browser -> Storage direct, then a metadata insert), alongside the Add button.
export function AssetsDropzone({
  projectId,
  studioId,
  existingAssets = [],
  children,
}: {
  projectId: string;
  studioId: string;
  existingAssets?: ExistingAsset[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const depth = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setNotice(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 6000);
  }

  // Dropping stages the files; nothing uploads until the details are confirmed.
  function stageFiles(files: File[]) {
    if (files.length === 0) return;
    const over = files.filter((f) => f.size > MAX_BYTES);
    const ok = files.filter((f) => f.size <= MAX_BYTES);
    if (over.length > 0) {
      flash(
        over.length === 1
          ? `"${over[0].name}" is over the ${MAX_MB} MB limit and was skipped.`
          : `${over.length} files are over the ${MAX_MB} MB limit and were skipped.`
      );
    }
    if (ok.length === 0) return;
    setStaged(
      ok.map((file) => ({
        file,
        name: baseName(file.name),
        type: assetType(file),
        versionNumber: "1",
        versionOf: null,
        ignored: false,
      }))
    );
  }

  function patch(i: number, next: Partial<Staged>) {
    setStaged((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...next } : s))
    );
  }

  async function confirmUpload() {
    const items = staged.filter((s) => s.name.trim());
    if (items.length === 0) {
      flash("Give each file a name first.");
      return;
    }
    setStaged([]);
    let done = 0;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      setStatus(`Uploading ${i + 1} of ${items.length}…`);
      try {
        const meta = await uploadAssetFile({
          studioId,
          projectId,
          file: s.file,
        });
        const fd = new FormData();
        fd.set("name", s.name.trim());
        fd.set("type", s.type);
        fd.set("version_number", s.versionNumber);
        fd.set("storage_path", meta.storagePath);
        fd.set("mime_type", meta.mimeType);
        fd.set("size_bytes", String(meta.sizeBytes));
        const res = s.versionOf
          ? await addVersion(s.versionOf.id, null, fd)
          : await createAsset(projectId, null, fd);
        if (res?.error) flash(`Couldn't add "${s.name}": ${res.error}`);
        else done++;
      } catch (e) {
        flash(
          `Couldn't upload "${s.name}": ${e instanceof Error ? e.message : "failed"}`
        );
      }
    }
    setStatus(null);
    if (done > 0) {
      flash(`Added ${done} ${done === 1 ? "asset" : "assets"}.`);
      router.refresh();
    }
  }

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setActive(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setActive(false);
        stageFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          stageFiles(Array.from(e.target.files ?? []));
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={!!status}
        className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-[12px] border-2 border-dashed border-border bg-surface-2/40 px-4 py-4 text-sm text-text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="font-semibold">
          Drag &amp; drop files here, or <span className="underline">click to browse</span>
        </span>
      </button>

      {children}

      {(active || status) && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[16px] border-2 border-dashed border-accent bg-accent-soft/50 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-pill bg-surface px-4 py-2 text-sm font-semibold text-accent shadow">
            {status ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="animate-spin" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
                {status}
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                Drop files to upload as assets
              </>
            )}
          </div>
        </div>
      )}

      {staged.length > 0 && (
        <Modal
          open
          onClose={() => setStaged([])}
          size="lg"
          title={
            staged.length === 1
              ? "Confirm file details"
              : `Confirm ${staged.length} files`
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Check the name, type, and version before these upload. Nothing is
              stored until you confirm.
            </p>
            <div className="space-y-2">
              {staged.map((s, i) => (
                <div
                  key={`${s.file.name}-${i}`}
                  className="rounded-[12px] border border-border bg-surface-2/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-text-faint">
                      {s.file.name} · {fileSize(s.file.size)}
                    </span>
                    <button
                      onClick={() =>
                        setStaged((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="shrink-0 text-[11px] font-semibold text-text-faint transition hover:text-red"
                    >
                      Remove
                    </button>
                  </div>
                  {(() => {
                    const match =
                      s.versionOf ?? findVersionParent(s.name, existingAssets);
                    if (!match || (!s.versionOf && s.ignored)) return null;
                    return (
                      <div className="mb-2">
                        <VersionSuggestion
                          parentName={match.name}
                          nextVersion={match.nextVersion}
                          accepted={Boolean(s.versionOf)}
                          onAccept={() =>
                            patch(i, {
                              versionOf: match,
                              versionNumber: String(match.nextVersion),
                            })
                          }
                          onUndo={() =>
                            patch(i, {
                              versionOf: null,
                              ignored: true,
                              versionNumber: "1",
                            })
                          }
                        />
                      </div>
                    );
                  })()}
                  <div
                    className={`grid gap-2 ${
                      s.versionOf
                        ? "sm:grid-cols-[100px]"
                        : "sm:grid-cols-[1fr_140px_100px]"
                    }`}
                  >
                    {/* Name and type belong to the parent file when this is
                        going in as a version, so only the number is editable. */}
                    {!s.versionOf && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                            Name
                          </label>
                          <input
                            value={s.name}
                            onChange={(e) => patch(i, { name: e.target.value })}
                            className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                            Type
                          </label>
                          <select
                            value={s.type}
                            onChange={(e) => patch(i, { type: e.target.value })}
                            className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
                          >
                            {TYPES.map((t) => (
                              <option key={t} value={t}>
                                {ASSET_TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                        Version
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={s.versionNumber}
                        onChange={(e) =>
                          patch(i, { versionNumber: e.target.value })
                        }
                        className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => setStaged([])}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmUpload}>
                Upload {staged.length > 1 ? staged.length : ""}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[12px] border border-border bg-surface px-4 py-3 text-sm text-text shadow-lg">
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="shrink-0 text-text-faint hover:text-text" aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
