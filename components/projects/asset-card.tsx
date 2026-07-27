"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  renameAsset,
  deleteAsset,
  deleteVersion,
  setVersionNumber,
} from "@/app/(app)/projects/[id]/actions";
import { emailAssetReviewLink } from "@/app/(app)/projects/[id]/share-actions";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { MergeAssetModal } from "@/components/projects/merge-asset-modal";
import { toast } from "@/components/ui/toast";
import { AssetStatusMenu } from "@/components/projects/asset-status-menu";
import { AddVersionForm } from "@/components/projects/add-version-form";
import { ReviewModal } from "@/components/projects/review-modal";
import { AssetViewer, viewerKind } from "@/components/projects/asset-viewer";
import { ShareReviewButton } from "@/components/projects/share-review-button";
import { Modal } from "@/components/ui/modal";
import { StatusTag } from "@/components/status-tag";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { ASSET_TYPE_HUE, ASSET_TYPE_LABEL, REVIEW_CYCLE } from "@/lib/status";
import { fileSize, shortDate } from "@/lib/format";
import {
  summarizeReview,
  type AssetWithVersions,
  type VersionRow,
} from "@/components/projects/asset-types";

const TYPE_ICON: Record<string, string> = {
  pdf: "PDF",
  video: "Video",
  audio: "Audio",
  office: "Doc",
  text: "Text",
  image: "Image",
  other: "File",
};

function Preview({
  version,
  hue,
  onOpen,
}: {
  version: VersionRow | undefined;
  hue: string;
  onOpen?: () => void;
}) {
  const link = version?.signedUrl ?? version?.url ?? null;
  const kind = version
    ? viewerKind(version.mime_type, version.storage_path ?? version.url)
    : "other";
  const canOpen = Boolean(version && link && onOpen);

  const inner = (
    <>
      {kind === "image" && link ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={link} alt="" className="h-full w-full object-cover" />
      ) : kind === "video" && link ? (
        // A muted video element shows the first frame as a thumbnail.
        <video
          src={link}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : version ? (
        <span
          className="flex flex-col items-center gap-1 text-xs font-bold"
          style={{ color: `var(--h-${hue})` }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          {TYPE_ICON[kind] ?? "File"}
        </span>
      ) : (
        <span
          className="text-xs font-semibold"
          style={{ color: `var(--h-${hue})` }}
        >
          No version yet
        </span>
      )}
      {version && (
        <span className="absolute bottom-2 left-2 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
          v{version.version_number}
        </span>
      )}
      {canOpen && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <span className="rounded-pill bg-white/95 px-3 py-1 text-xs font-bold text-black shadow-sm">
            Open
          </span>
        </span>
      )}
    </>
  );

  const cls =
    "group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[12px]";

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`${cls} w-full cursor-pointer`}
        style={{ backgroundColor: `var(--h-${hue}-bg)` }}
        aria-label="Open file"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cls} style={{ backgroundColor: `var(--h-${hue}-bg)` }}>
      {inner}
    </div>
  );
}

export function AssetCard({
  asset,
  projectId,
  studioId,
  currentUserId,
  reviewLink,
  emailEnabled = false,
}: {
  asset: AssetWithVersions;
  projectId: string;
  studioId: string;
  currentUserId: string;
  reviewLink?: { id: string; token: string; recipient?: string | null } | null;
  emailEnabled?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reviewVersion, setReviewVersion] = useState<VersionRow | null>(null);
  const [viewVersion, setViewVersion] = useState<VersionRow | null>(null);
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [confirmAsset, setConfirmAsset] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [, startVersionDelete] = useTransition();
  const router = useRouter();
  const hue = ASSET_TYPE_HUE[asset.type] ?? "cyan";
  // A new version on an asset already in the review cycle reopens the round
  // server-side, so offer to hand it to the client right there.
  const inReviewCycle = REVIEW_CYCLE.includes(asset.status);
  const current =
    asset.versions.find((v) => v.id === asset.current_version_id) ??
    asset.versions[0];
  const currentSummary = current ? summarizeReview(current.approvals) : null;

  return (
    <div className="rounded-[15px] border border-border bg-surface p-3 shadow-sm">
      <Preview
        version={current}
        hue={hue}
        onOpen={current ? () => setViewVersion(current) : undefined}
      />

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-text">{asset.name}</h4>
          <p className="text-xs text-text-faint">
            {ASSET_TYPE_LABEL[asset.type]}
          </p>
        </div>
        <AssetStatusMenu assetId={asset.id} status={asset.status} />
      </div>

      {/* Current-version review signal (color-as-signal), opens review */}
      {current && currentSummary && (
        <button
          onClick={() => setReviewVersion(current)}
          className="mt-3 flex w-full items-center justify-between rounded-[10px] border border-border px-2.5 py-1.5 text-left transition hover:border-border-strong hover:bg-surface-2/60"
        >
          <StatusTag hue={currentSummary.hue}>{currentSummary.label}</StatusTag>
          <span className="text-xs font-semibold text-text-muted">
            Review
            {current.comments.length > 0 ? ` · ${current.comments.length}` : ""}
          </span>
        </button>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 rounded-[9px] bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent hover:text-accent-fg"
        >
          <PlusIcon /> Version
        </button>
        {asset.versions.length > 0 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="rounded-[9px] px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            {asset.versions.length} version
            {asset.versions.length === 1 ? "" : "s"}
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {current && (
            <ShareReviewButton
              projectId={projectId}
              assetId={asset.id}
              initialToken={reviewLink?.token ?? null}
              linkId={reviewLink?.id ?? null}
            />
          )}
          {asset.versions.length > 0 && (
            <button
              onClick={() => setMergeOpen(true)}
              title="Fold this file into another file as a version"
              aria-label="Make this a version of another file"
              className="rounded-[9px] px-2 py-1 text-text-faint transition hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 3v8a4 4 0 0 0 4 4h6" />
                <path d="M17 3v18" />
                <path d="m14 12 3 3-3 3" />
              </svg>
            </button>
          )}
          {/* Deleting the whole file has to live here, not only inside the
              viewer: a file with no versions left can't open the viewer. */}
          {confirmAsset ? (
            <>
              <button
                onClick={() =>
                  startVersionDelete(async () => {
                    const res = await deleteAsset(asset.id);
                    if (res?.error) toast(res.error, "error");
                    setConfirmAsset(false);
                    router.refresh();
                  })
                }
                className="rounded-[9px] bg-red px-2 py-1 text-xs font-bold text-white transition hover:opacity-90"
              >
                Delete file
              </button>
              <button
                onClick={() => setConfirmAsset(false)}
                className="rounded-[9px] px-1.5 py-1 text-xs font-semibold text-text-faint transition hover:text-text"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmAsset(true)}
              title="Delete this file and all its versions"
              aria-label="Delete file"
              className="rounded-[9px] px-2 py-1 text-text-faint transition hover:bg-red-bg hover:text-red"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          )}
        </span>
      </div>

      {showHistory && asset.versions.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-border pt-3">
          {asset.versions.map((v) => {
            const link = v.signedUrl ?? v.url;
            const s = summarizeReview(v.approvals);
            return (
              <li key={v.id} className="flex items-start gap-2 text-sm">
                {editVersion === v.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs font-bold text-text-muted">v</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      autoFocus
                      defaultValue={v.version_number}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditVersion(null);
                      }}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        setEditVersion(null);
                        if (!next || next === v.version_number) return;
                        startVersionDelete(async () => {
                          const res = await setVersionNumber(v.id, next);
                          if (res?.error) toast(res.error, "error");
                          router.refresh();
                        });
                      }}
                      aria-label="Version number"
                      className="w-14 rounded-[7px] border border-accent bg-bg px-1.5 py-0.5 text-xs font-bold text-text outline-none"
                    />
                  </span>
                ) : (
                  <button
                    onClick={() => setEditVersion(v.id)}
                    title="Change the version number"
                    className="shrink-0"
                  >
                    <StatusTag
                      hue={v.id === asset.current_version_id ? "green" : "indigo"}
                      dot={false}
                    >
                      v{v.version_number}
                    </StatusTag>
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  {v.notes && (
                    <p className="text-sm text-text-muted">{v.notes}</p>
                  )}
                  <p className="text-xs text-text-faint">
                    {shortDate(v.created_at)}
                    {v.size_bytes ? ` · ${fileSize(v.size_bytes)}` : ""}
                    {link ? " · " : ""}
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent hover:underline"
                      >
                        Download
                      </a>
                    )}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {link && (
                      <button
                        onClick={() => setViewVersion(v)}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => setReviewVersion(v)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Review
                      {v.comments.length > 0 ? ` (${v.comments.length})` : ""}
                    </button>
                    {v.approvals.length > 0 && (
                      <StatusTag hue={s.hue} dot={false}>
                        {s.label}
                      </StatusTag>
                    )}
                    {confirmVersion === v.id ? (
                      <span className="ml-auto flex items-center gap-1.5">
                        {/* Removing the only version would leave an empty file
                            shell, so delete the whole file instead. */}
                        <button
                          onClick={() =>
                            startVersionDelete(async () => {
                              const last = asset.versions.length === 1;
                              const res = last
                                ? await deleteAsset(asset.id)
                                : await deleteVersion(v.id);
                              if (res?.error) toast(res.error, "error");
                              setConfirmVersion(null);
                              router.refresh();
                            })
                          }
                          className="rounded-[7px] bg-red px-2 py-0.5 text-[11px] font-bold text-white transition hover:opacity-90"
                        >
                          {asset.versions.length === 1
                            ? "Delete file"
                            : `Delete v${v.version_number}`}
                        </button>
                        <button
                          onClick={() => setConfirmVersion(null)}
                          className="text-[11px] font-semibold text-text-faint hover:text-text"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmVersion(v.id)}
                        className="ml-auto text-xs font-semibold text-text-faint transition hover:text-red"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={`New version of ${asset.name}`}
      >
        <AddVersionForm
          assetId={asset.id}
          projectId={projectId}
          studioId={studioId}
          nextVersion={
            asset.versions.reduce((m, v) => Math.max(m, v.version_number), 0) + 1
          }
          onDone={() => {
            setAddOpen(false);
            if (inReviewCycle && emailEnabled) setNotifyOpen(true);
          }}
        />
      </Modal>

      {mergeOpen && (
        <MergeAssetModal
          open
          onClose={() => setMergeOpen(false)}
          projectId={projectId}
          assetId={asset.id}
          assetName={asset.name}
          versionCount={asset.versions.length}
        />
      )}

      {notifyOpen && (
        <SendDocEmailModal
          open
          onClose={() => setNotifyOpen(false)}
          title={`Send the new version of ${asset.name}`}
          defaultTo={reviewLink?.recipient ?? null}
          defaultSubject={`A new version of ${asset.name} is ready for review`}
          shareUrl={
            reviewLink?.token
              ? `${window.location.origin}/r/${reviewLink.token}`
              : null
          }
          dueDateField
          onSend={async (input) => {
            const res = await emailAssetReviewLink(projectId, asset.id, input);
            if ("ok" in res) router.refresh();
            return res;
          }}
        />
      )}

      {reviewVersion && (
        <ReviewModal
          open={Boolean(reviewVersion)}
          onClose={() => setReviewVersion(null)}
          projectId={projectId}
          assetName={asset.name}
          version={reviewVersion}
          currentUserId={currentUserId}
        />
      )}

      {viewVersion && (
        <AssetViewer
          open={Boolean(viewVersion)}
          onClose={() => setViewVersion(null)}
          name={asset.name}
          version={viewVersion}
          onRename={async (next) => {
            const res = await renameAsset(asset.id, next);
            if (res?.error) return res.error;
            router.refresh();
            return null;
          }}
          onDelete={async () => {
            const res = await deleteAsset(asset.id);
            if (res?.error) return res.error;
            router.refresh();
            return null;
          }}
        />
      )}
    </div>
  );
}
