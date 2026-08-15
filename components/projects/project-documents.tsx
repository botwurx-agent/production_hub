"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fileSize, shortDate } from "@/lib/format";
import { documentSource } from "@/lib/documents";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { PdfThumb } from "@/components/projects/pdf-thumb";
import { viewerKind } from "@/lib/file-kind";
import { createAsset, addVersion } from "@/app/(app)/projects/[id]/actions";
import type { AssetWithVersions } from "@/components/projects/asset-types";

/**
 * The paperwork side of a project: what arrived from outside and where it came
 * from.
 *
 * Two things it deliberately does NOT show, because they belong to creative
 * work and mean nothing here: a review status, and a share-for-approval link.
 * Nobody pins a comment on an insurance certificate.
 *
 * What it does show instead is provenance, which is the whole reason for
 * filing something rather than leaving it in a thread: the sender, the date and
 * the subject of the email it came in on.
 */
function DocIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-text-faint"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function ProjectDocuments({
  projectId,
  documents,
}: {
  projectId: string;
  documents: AssetWithVersions[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef<HTMLInputElement>(null);
  const [versionFor, setVersionFor] = useState<string | null>(null);
  const [busy, start] = useTransition();

  async function upload(files: File[]) {
    for (const file of files) {
      try {
        const stored = await uploadAssetFile({ studioId: "", projectId, file });
        const form = new FormData();
        form.set("name", file.name);
        form.set("type", "document");
        form.set("storage_path", stored.storagePath);
        form.set("mime_type", stored.mimeType);
        form.set("size_bytes", String(stored.sizeBytes));
        const res = await createAsset(projectId, null, form);
        if (res && "error" in res && res.error) {
          toast(res.error, "error");
          return;
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "That upload failed.", "error");
        return;
      }
    }
    toast(files.length === 1 ? "Document filed." : "Documents filed.", "success");
    router.refresh();
  }

  async function newVersion(assetId: string, file: File) {
    try {
      const stored = await uploadAssetFile({ studioId: "", projectId, file });
      const form = new FormData();
      form.set("storage_path", stored.storagePath);
      form.set("mime_type", stored.mimeType);
      form.set("size_bytes", String(stored.sizeBytes));
      const res = await addVersion(assetId, null, form);
      if (res && "error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      toast("New version filed.", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That upload failed.", "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text">
            {documents.length} document{documents.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-text-muted">
            Crew with access to this project can see these.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-[10px] bg-accent px-3 py-2 text-xs font-semibold text-accent-fg disabled:opacity-60"
        >
          Upload a document
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            // Copy the FileList before clearing the input: it is a live view of
            // the selection, and resetting value empties it.
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (picked.length) start(() => upload(picked));
          }}
        />
        <input
          ref={versionRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            const assetId = versionFor;
            setVersionFor(null);
            if (picked && assetId) start(() => newVersion(assetId, picked));
          }}
        />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          hue="cyan"
          title="No documents filed yet"
          description="Permits, insurance certificates, licences, delivery specs, schedules: anything that arrives from outside and is not creative work."
          steps={[
            {
              title: "File it from the email",
              text: "An attachment on a linked thread gets an Add to documents button.",
            },
            {
              title: "It remembers where it came from",
              text: "Who sent it, when, and the subject line, so you never have to hunt the thread again.",
            },
            {
              title: "Newer copies are versions",
              text: "A reissued permit is v2 of the same document, not a second file.",
            },
          ]}
        />
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const current =
              doc.versions.find((v) => v.id === doc.current_version_id) ??
              doc.versions[0];
            const source = documentSource(doc.external_ref ?? null);
            // Only a PDF has a page to draw. A .docx would just fail and fall
            // back, so it is never asked.
            const isPdf =
              viewerKind(
                current?.mime_type ?? null,
                current?.storage_path ?? doc.name
              ) === "pdf";
            return (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                {/* A row of filenames tells you nothing about which permit is
                    which. Page one does. */}
                <span className="grid h-[52px] w-[42px] shrink-0 place-items-center overflow-hidden rounded-[7px] border border-border bg-surface-2">
                  {isPdf && current ? (
                    <PdfThumb
                      fileUrl={current.signedUrl ?? current.url}
                      posterUrl={current.posterUrl}
                      projectId={projectId}
                      versionId={current.id}
                      className="h-full w-full object-cover object-top"
                      boxClassName="flex h-full w-full items-center justify-center overflow-hidden"
                      fallback={<DocIcon />}
                    />
                  ) : (
                    <DocIcon />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">
                    {doc.name}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    {source ?? `Uploaded ${shortDate(doc.created_at)}`}
                  </p>
                  <p className="text-[11px] text-text-faint">
                    {doc.versions.length > 1
                      ? `v${current?.version_number ?? 1}, ${doc.versions.length} versions`
                      : "v1"}
                    {current?.size_bytes
                      ? ` · ${fileSize(current.size_bytes)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setVersionFor(doc.id);
                      versionRef.current?.click();
                    }}
                    className="text-xs font-medium text-text-muted hover:text-text disabled:opacity-60"
                  >
                    New version
                  </button>
                  {current?.signedUrl ? (
                    <a
                      href={current.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
