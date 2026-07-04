"use client";

import { useState } from "react";
import { AssetStatusMenu } from "@/components/projects/asset-status-menu";
import { AddVersionForm } from "@/components/projects/add-version-form";
import { ReviewModal } from "@/components/projects/review-modal";
import { AssetViewer, viewerKind } from "@/components/projects/asset-viewer";
import { Modal } from "@/components/ui/modal";
import { StatusTag } from "@/components/status-tag";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { ASSET_TYPE_HUE, ASSET_TYPE_LABEL } from "@/lib/status";
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
  text: "Text",
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
  const kind = version ? viewerKind(version.mime_type) : "other";
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
}: {
  asset: AssetWithVersions;
  projectId: string;
  studioId: string;
  currentUserId: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reviewVersion, setReviewVersion] = useState<VersionRow | null>(null);
  const [viewVersion, setViewVersion] = useState<VersionRow | null>(null);
  const hue = ASSET_TYPE_HUE[asset.type] ?? "cyan";
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
      </div>

      {showHistory && asset.versions.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-border pt-3">
          {asset.versions.map((v) => {
            const link = v.signedUrl ?? v.url;
            const s = summarizeReview(v.approvals);
            return (
              <li key={v.id} className="flex items-start gap-2 text-sm">
                <StatusTag
                  hue={v.id === asset.current_version_id ? "green" : "indigo"}
                  dot={false}
                >
                  v{v.version_number}
                </StatusTag>
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
                        Open
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
          onDone={() => setAddOpen(false)}
        />
      </Modal>

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
        />
      )}
    </div>
  );
}
