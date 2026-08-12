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
 * File a batch of elements in one pass.
 *
 * Came from real use: a job needed twenty-one elements and the single-element
 * dialog meant twenty-one rounds of open, name, paste, close.
 *
 * LINKS ARE THE PRIMARY PATH, not files. The images are generated on another
 * platform and arrive as share pages, so the first version of this, which only
 * took dropped files, solved a problem nobody had. Paste the whole list at
 * once, one per line, and each becomes a row.
 *
 * Deliberately not a second copy of the full dialog. A row captures the
 * minimum an element needs to exist and be reachable from a prompt bar: a
 * name, a kind, one image. Description, prompt, handle and further sheets are
 * still added by opening the element.
 */

type Row = {
  key: string;
  /** Exactly one of these. */
  file: File | null;
  url: string | null;
  /** Object URL for a file; for a link there is nothing to show until it is fetched. */
  preview: string | null;
  name: string;
  kind: string;
};

let nextKey = 1;

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
  const [paste, setPaste] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Object URLs are a manual resource: without this, previewing forty images
  // holds forty of them for the life of the page.
  useEffect(() => {
    return () => {
      rows.forEach((r) => r.preview && URL.revokeObjectURL(r.preview));
    };
    // Unmount only; per-row revoke happens in remove().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    rows.forEach((r) => r.preview && URL.revokeObjectURL(r.preview));
    setRows([]);
    setPaste("");
    setProgress(null);
    setSaving(false);
  }

  function close() {
    reset();
    onClose();
  }

  function addLinks() {
    const seen = new Set(rows.map((r) => r.url).filter(Boolean));
    const urls = paste
      .split(/[\n\s]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      // A link already in the list is a paste repeated, not a second element.
      .filter((u) => !seen.has(u) && (seen.add(u), true));

    if (!urls.length) {
      toast("No links found in that. One per line.", "error");
      return;
    }
    setRows((prev) => [
      ...prev,
      ...urls.map((url) => ({
        key: `k${nextKey++}`,
        file: null,
        url,
        preview: null,
        name: "",
        kind: defaultKind ?? PICKABLE_KINDS[0].key,
      })),
    ]);
    setPaste("");
  }

  function addFiles(list: FileList | null) {
    // Read the FileList BEFORE clearing the input: it is a live view of the
    // selection, so clearing first empties it.
    const files = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = "";
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setRows((prev) => [
      ...prev,
      ...images.map((file) => ({
        key: `k${nextKey++}`,
        file,
        url: null,
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
      if (row?.preview) URL.revokeObjectURL(row.preview);
      return prev.filter((r) => r.key !== key);
    });
  }

  /** Sets every row's kind at once, which is the common case for one batch. */
  function setAllKinds(kind: string) {
    setRows((prev) => prev.map((r) => ({ ...r, kind })));
  }

  const unnamed = rows.filter((r) => !r.name.trim()).length;

  async function save() {
    if (!rows.length || unnamed) return;
    setSaving(true);
    try {
      const items: {
        name: string;
        kind: string;
        filePath?: string | null;
        url?: string | null;
      }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.file) {
          setProgress(`Uploading ${i + 1} of ${rows.length}...`);
          // Direct to storage through a server-minted signed URL, so a batch
          // of large stills is not bounded by the serverless request body.
          const up = await uploadAssetFile({
            studioId,
            projectId,
            file: row.file,
          });
          items.push({
            name: row.name.trim(),
            kind: row.kind,
            filePath: up.storagePath,
          });
        } else {
          items.push({ name: row.name.trim(), kind: row.kind, url: row.url });
        }
      }

      setProgress(
        `Creating ${items.length} element${items.length === 1 ? "" : "s"}...`
      );
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
      <div className="space-y-4">
        {/* Paste box first: this is how the images actually arrive. */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Paste links{" "}
            <span className="font-normal normal-case text-text-faint">
              · one per line, share pages or direct image links
            </span>
          </label>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onPaste={(e) => {
              // A multi-line paste is the whole batch arriving, so it becomes
              // rows immediately rather than sitting in a box waiting for a
              // second click.
              const text = e.clipboardData.getData("text");
              if (/\n/.test(text.trim())) {
                e.preventDefault();
                addLinksFrom(text);
              }
            }}
            rows={3}
            disabled={saving}
            placeholder={"https://higgsfield.ai/...\nhttps://higgsfield.ai/..."}
            className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 font-mono text-[12.5px] text-text outline-none focus:border-border-strong"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={addLinks}
              disabled={saving || !paste.trim()}
              className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg transition hover:bg-accent-strong disabled:opacity-50"
            >
              Add links
            </button>
            <span className="text-[11.5px] text-text-faint">or</span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={saving}
              className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-50"
            >
              Choose files
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
        </div>

        {rows.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-[13px] font-semibold text-text">
                {rows.length} element{rows.length === 1 ? "" : "s"}
              </span>
              {unnamed > 0 && (
                <span
                  className="rounded-pill px-2 py-0.5 text-[11.5px] font-bold"
                  style={{
                    background: "var(--h-amber-bg)",
                    color: "var(--h-amber)",
                  }}
                >
                  {unnamed} need{unnamed === 1 ? "s" : ""} a name
                </span>
              )}
              {/* One batch is usually all one category, so setting it once
                  beats setting it twenty-one times. */}
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-[11.5px] text-text-faint">Set all to</span>
                <select
                  defaultValue=""
                  disabled={saving}
                  onChange={(e) => {
                    if (e.target.value) setAllKinds(e.target.value);
                    e.target.value = "";
                  }}
                  className="rounded-[9px] border border-border bg-surface px-2 py-1 text-xs font-semibold text-text outline-none"
                >
                  <option value="">Category...</option>
                  {PICKABLE_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <div className="space-y-2">
              {rows.map((r, i) => {
                const meta = kindMeta(r.kind);
                return (
                  <div
                    key={r.key}
                    className="flex items-center gap-3 rounded-[11px] border border-border p-2"
                    style={{ borderLeft: `3px solid var(--h-${meta.hue})` }}
                  >
                    {r.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.preview}
                        alt=""
                        className="h-12 w-16 shrink-0 rounded-[8px] object-cover"
                      />
                    ) : (
                      <span className="grid h-12 w-16 shrink-0 place-items-center rounded-[8px] bg-surface-2 text-[10px] font-bold text-text-faint">
                        {i + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <input
                        value={r.name}
                        onChange={(e) => patch(r.key, { name: e.target.value })}
                        placeholder="Name this element"
                        disabled={saving}
                        className={`w-full rounded-[9px] border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-strong ${
                          r.name.trim() ? "border-border" : "border-amber"
                        }`}
                      />
                      {r.url && (
                        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-text-faint">
                          {r.url}
                        </span>
                      )}
                    </div>
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

            <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
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
              {saving && !progress && (
                <span className="text-[12.5px] text-text-faint">Working...</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );

  function addLinksFrom(text: string) {
    const seen = new Set(rows.map((r) => r.url).filter(Boolean));
    const urls = text
      .split(/[\n\s]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .filter((u) => !seen.has(u) && (seen.add(u), true));
    if (!urls.length) return;
    setRows((prev) => [
      ...prev,
      ...urls.map((url) => ({
        key: `k${nextKey++}`,
        file: null,
        url,
        preview: null,
        name: "",
        kind: defaultKind ?? PICKABLE_KINDS[0].key,
      })),
    ]);
    setPaste("");
  }
}
