"use client";

import { useState } from "react";
import { AssetStatusMenu } from "@/components/projects/asset-status-menu";
import { AddVersionForm } from "@/components/projects/add-version-form";
import { Modal } from "@/components/ui/modal";
import { StatusTag } from "@/components/status-tag";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { ASSET_TYPE_HUE, ASSET_TYPE_LABEL } from "@/lib/status";
import { fileSize, shortDate } from "@/lib/format";
import type { AssetWithVersions, VersionRow } from "@/components/projects/asset-types";

function Preview({
  version,
  hue,
}: {
  version: VersionRow | undefined;
  hue: string;
}) {
  const isImage =
    version?.signedUrl && version.mime_type?.startsWith("image/");

  return (
    <div
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[12px]"
      style={{ backgroundColor: `var(--h-${hue}-bg)` }}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={version!.signedUrl!}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="text-xs font-semibold"
          style={{ color: `var(--h-${hue})` }}
        >
          {version ? "No preview" : "No version yet"}
        </span>
      )}
      {version && (
        <span className="absolute bottom-2 left-2 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
          v{version.version_number}
        </span>
      )}
    </div>
  );
}

export function AssetCard({ asset }: { asset: AssetWithVersions }) {
  const [addOpen, setAddOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const hue = ASSET_TYPE_HUE[asset.type] ?? "cyan";
  const current =
    asset.versions.find((v) => v.id === asset.current_version_id) ??
    asset.versions[0];

  return (
    <div className="rounded-[15px] border border-border bg-surface p-3 shadow-sm">
      <Preview version={current} hue={hue} />

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-text">{asset.name}</h4>
          <p className="text-xs text-text-faint">
            {ASSET_TYPE_LABEL[asset.type]}
          </p>
        </div>
        <AssetStatusMenu assetId={asset.id} status={asset.status} />
      </div>

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
        <AddVersionForm assetId={asset.id} onDone={() => setAddOpen(false)} />
      </Modal>
    </div>
  );
}
