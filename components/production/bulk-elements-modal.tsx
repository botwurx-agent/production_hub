"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { addReferencesBulk } from "@/app/(app)/projects/[id]/cast-actions";
import { nameFromFilename } from "@/lib/filename-name";
import { PICKABLE_KINDS, kindMeta } from "@/lib/cast";

/**
 * File a folder of images as elements, in one pass.
 *
 * Came from real use: a job needed twenty-one elements and the single-element
 * dialog meant twenty-one rounds of open, name, upload, close. This is not a
 * second copy of that dialog. It captures the minimum an element needs to
 * exist and be reachable from a prompt bar (a name, a kind, one image); the
 * description, the prompt, the handle and further sheets are added by opening
 * the element afterwards, which is where those fields belong.
 *
 * Names are guessed from the file names and left BLANK when the guess would be
 * machine noise, because a prefilled field is a trusted field and the failure
 * mode here is twenty-one elements called hf_20260721. Saving is blocked while
 * any name is missing, and the button says how many.
 */
export function BulkElementsModal({
  projectId,
  studioId,
  open,
  onClose,
  defaultKind,
}: {
  projectId: string;
  studioId: string;
  open: boolean;
  onClose: () => void;
  /** Whatever the operator was adding when they reached for this. */
  defaultKind?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  type Row = {
    key: string;
    file: File;
    preview: string;
    name: string;
    kind: string;
  };

  // Object URLs are a manual resource: without this, previewing forty images
  // holds forty of them for the life of the page.
  useEffect(() => {
    return () => {
      rows.forEach((r) => URL.revokeObjectURL(r.preview));
    };
    // Cleanup on unmount only; per-row revoke happens in remove().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    setRows([]);
    setProgress(null);
    setSaving(false);
  }

  function close() {
    reset();
    onClose();
  }

  function addFiles(list: FileList | null) {
    // Read the FileList BEFORE clearing the input: it is a live view of the
    // selection, so clearing first empties it.
    const files = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = "";
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length < files.length) {
      toast(
        `Skipped ${files.length - images.length} file${
          files.length - images.length === 1 ? "" : "s"
        } that ${files.length - images.length === 1 ? "is" : "are"} not an image.`,
        "info"
      );
    }
    if (!images.length) return;

    setRows((prev) => [
      ...prev,
      ...images.map((file, i) => ({
        key: `${Date.now()}-${prev.length + i}`,
        file,
        preview: URL.createObjectURL(file),
        name: nameFromFilename(file.name) ?? "",
        kind: defaultKind ?? PICKABLE_KINDS[0].key,
      })),
    ]);
  }

  function patch(key: string, next: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  function remove(key: string) {
    setRows((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row) URL.revokeObjectURL(row.preview);
      return prev.filter((r) => r.key !== key);
    });
  }

  const unnamed = rows.filter((r) => !r.name.trim()).length;

  async function save() {
    if (!rows.length || unnamed) return;
    setSaving(true);
    try {
      const items: {
        name: string;
        kind: string;
        filePath: string;
      }[] = [];
      for (let i = 0; i < rows.length; i++) {
        setProgress(`Uploading ${i + 1} of ${rows.length}...`);
        // Direct to storage through a server-minted signed URL, so a folder of
        // large stills is not bounded by the serverless request body.
        const up = await uploadAssetFile({
          studioId,
          projectId,
          file: rows[i].file,
        });
        items.push({
          name: rows[i].name.trim(),
          kind: rows[i].kind,
          filePath: up.storagePath,
        });
      }

      setProgress("Creating elements...");
      const res = await addReferencesBulk(projectId, items);

      if (res.failed.length) {
        toast(
          `Added ${res.added}. ${res.failed.length} did not save: ${res.failed
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")}${res.failed.length > 3 ? "..." : ""}`,
          "error"
        );
      } else {
        toast(
          `Added ${res.added} element${res.added === 1 ? "" : "s"}.`,
          "success"
        );
      }
      close();
      router.refresh();
    } catch (e) {
      setProgress(null);
      setSaving(false);
      toast(
        e instanceof Error ? e.message : "Those elements could not be added.",
        "error"
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : close}
      size="xl"
      id="bulk-elements"
      title="Add several elements"
    >
      {rows.length === 0 ? (
        <div>
          <p className="mb-3 text-[13px] text-text-muted">
            Drop in a folder of reference images and each one becomes an
            element. Names come from the file names where they read as names.
            Everything else (description, prompt, handle, more images) is added
            by opening the element afterwards.
          </p>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-border bg-surface-2 p-8 text-center transition hover:border-accent"
          >
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-full border border-border-strong text-lg text-text-faint">
              +
            </span>
            <span className="font-display text-sm font-bold text-text-muted">
              Drop images, or click to choose
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-text">
              {rows.length} image{rows.length === 1 ? "" : "s"}
            </span>
            {unnamed > 0 && (
              <span className="rounded-pill px-2 py-0.5 text-[11.5px] font-bold" style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)" }}>
                {unnamed} need{unnamed === 1 ? "s" : ""} a name
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="ml-auto rounded-[9px] border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-50"
            >
              + More
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          <div className="space-y-2">
            {rows.map((r) => {
              const meta = kindMeta(r.kind);
              return (
                <div
                  key={r.key}
                  className="flex items-center gap-3 rounded-[11px] border border-border p-2"
                  style={{ borderLeft: `3px solid var(--h-${meta.hue})` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.preview}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded-[8px] object-cover"
                  />
                  <input
                    value={r.name}
                    onChange={(e) => patch(r.key, { name: e.target.value })}
                    placeholder="Name this element"
                    disabled={saving}
                    className={`min-w-0 flex-1 rounded-[9px] border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-strong ${
                      r.name.trim() ? "border-border" : "border-amber"
                    }`}
                  />
                  <select
                    value={r.kind}
                    onChange={(e) => patch(r.key, { kind: e.target.value })}
                    disabled={saving}
                    className="shrink-0 rounded-[9px] border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-text outline-none"
                  >
                    {PICKABLE_KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(r.key)}
                    disabled={saving}
                    aria-label="Remove"
                    className="shrink-0 px-1 text-text-faint transition hover:text-red disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => void save()}
              disabled={saving || unnamed > 0}
              className="rounded-[10px] bg-accent px-4 py-2 text-sm font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
            >
              {unnamed > 0
                ? `${unnamed} still need${unnamed === 1 ? "s" : ""} a name`
                : `Add ${rows.length} element${rows.length === 1 ? "" : "s"}`}
            </button>
            {progress && (
              <span className="text-[12.5px] text-text-faint">{progress}</span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
