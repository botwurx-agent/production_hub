"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusTag } from "@/components/status-tag";
import { ShareReviewButton } from "@/components/projects/share-review-button";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { addMasterCutVersion } from "@/app/(app)/projects/[id]/actions";
import {
  summarizeReview,
  type AssetWithVersions,
  type VersionRow,
} from "@/components/projects/asset-types";
import { viewerKind } from "@/lib/file-kind";
import { timeAgo } from "@/lib/format";

// The assembled deliverable and its revision rounds. Lives in the same
// Assets -> Versions spine as everything else (the project's asset of type
// 'cut'); this band is just its home on the pipeline page. We organize the
// versions + timecoded feedback; the editing happens off-app.

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

function UploadVersionModal({
  projectId,
  studioId,
  nextVersion,
  onClose,
}: {
  projectId: string;
  studioId: string;
  nextVersion: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [prog, setProg] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!file && !link.trim()) { setErr("Upload the cut, or paste a link to it."); return; }
    start(async () => {
      let storagePath: string | null = null;
      let mimeType: string | null = null;
      if (file) {
        try {
          setProg("Uploading…");
          const up = await uploadAssetFile({ studioId, projectId, file });
          storagePath = up.storagePath;
          mimeType = up.mimeType || null;
        } catch (e) {
          setErr(`Upload failed: ${(e as Error).message}`); setProg(null); return;
        }
      } else {
        setProg("Pulling the cut in…");
      }
      const res = await addMasterCutVersion(projectId, {
        storagePath,
        mimeType,
        link: file ? null : link.trim() || null,
        notes: notes.trim() || null,
      });
      setProg(null);
      if (res?.error) { setErr(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} size="md" title={`Upload version ${nextVersion}`}>
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Drop the exported cut (or paste a link to it). We store this version and open it
          for review; the editing itself happens wherever you assemble the cut.
        </p>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            Upload the cut <span className="font-normal normal-case text-text-faint">(video file)</span>
          </label>
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-text-muted file:mr-3 file:rounded-[8px] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent-fg" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            …or paste a link <span className="font-normal normal-case text-text-faint">(share page or direct URL)</span>
          </label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…"
            className={`mt-1 ${field}`} disabled={Boolean(file)} />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            What changed <span className="font-normal normal-case text-text-faint">(optional)</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="e.g. Addressed round-1 notes: retimed the open, swapped shot 4…" className={`mt-1 ${field}`} />
        </div>
        {err && <p className="rounded-[9px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{err}</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          {busy && prog && <span className="mr-auto text-xs font-medium text-text-muted">{prog}</span>}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Working…" : `Add version ${nextVersion}`}</Button>
        </div>
      </div>
    </Modal>
  );
}

function VersionRowView({
  projectId, version, isLatest,
}: {
  projectId: string; version: VersionRow; isLatest: boolean;
}) {
  const summary = summarizeReview(version.approvals);
  const kind = viewerKind(version.mime_type, `v${version.version_number}`);
  const isVideo = kind === "video" && Boolean(version.signedUrl);
  const openComments = version.comments.filter((c) => !c.resolved_at).length;

  return (
    <div className={`flex items-center gap-3 rounded-[12px] border p-2.5 ${isLatest ? "border-border-strong bg-surface-2/40" : "border-border"}`}>
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-[8px] bg-black">
        {version.signedUrl ? (
          isVideo ? (
            <video src={`${version.signedUrl}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={version.signedUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-white/50">link</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-text">Version {version.version_number}</span>
          {isLatest && <span className="rounded-[5px] bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">Latest</span>}
          <StatusTag hue={summary.hue}>{summary.label}</StatusTag>
          {openComments > 0 && (
            <span className="text-xs font-semibold text-text-muted">{openComments} open note{openComments === 1 ? "" : "s"}</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-text-faint">
          {timeAgo(version.created_at)}
          {version.notes ? <span className="text-text-muted"> · {version.notes}</span> : null}
        </div>
      </div>
      <Link href={`/projects/${projectId}/review/cut/${version.id}`}
        className="rounded-[10px] border border-border-strong px-3 py-1.5 text-sm font-semibold text-text transition hover:border-accent hover:text-accent">
        Review
      </Link>
    </div>
  );
}

export function MasterCutBand({
  projectId, studioId, masterCut, reviewToken, reviewLinkId, currentUserId,
}: {
  projectId: string;
  studioId: string;
  masterCut: AssetWithVersions | null;
  reviewToken: string | null;
  reviewLinkId: string | null;
  currentUserId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const versions = masterCut?.versions ?? []; // newest first (loader orders desc)
  const nextVersion = (versions[0]?.version_number ?? 0) + 1;

  return (
    <div className="rounded-[14px] border border-border p-4" style={{ borderTop: "3px solid var(--h-green)" }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] text-sm" style={{ background: "var(--h-green-bg)", color: "var(--h-green)" }}>
          ▦
        </span>
        <div className="mr-auto">
          <h4 className="text-sm font-bold text-text">Master cut</h4>
          <p className="text-xs text-text-faint">The assembled film and its revision rounds. Every version and comment is kept.</p>
        </div>
        {masterCut && (
          <ShareReviewButton projectId={projectId} assetId={masterCut.id} initialToken={reviewToken} linkId={reviewLinkId} />
        )}
        {versions.length > 0 && (
          <Button size="sm" onClick={() => setUploading(true)}>+ New version</Button>
        )}
      </div>

      {versions.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-[12px] border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-text-muted">
            No cut yet. When your shots are picked and post is done, upload version 1 of the assembled film.
          </p>
          <Button size="sm" onClick={() => setUploading(true)}>Upload version 1</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v, i) => (
            <VersionRowView
              key={v.id}
              projectId={projectId}
              version={v}
              isLatest={i === 0}
            />
          ))}
        </div>
      )}

      {uploading && (
        <UploadVersionModal projectId={projectId} studioId={studioId} nextVersion={nextVersion} onClose={() => setUploading(false)} />
      )}
    </div>
  );
}
