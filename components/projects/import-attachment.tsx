"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  importAttachment,
  importAttachmentAsVersion,
  getProjectAssets,
} from "@/app/(app)/projects/[id]/email-actions";

export function ImportAttachment({
  projectId,
  messageId,
  attachmentId,
  filename,
  mimeType,
}: {
  projectId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();

  function openModal() {
    setOpen(true);
    setError(null);
    if (assets === null) {
      start(async () => {
        const res = await getProjectAssets(projectId);
        if ("error" in res) setError(res.error);
        else setAssets(res.assets);
      });
    }
  }

  function finish(res: { error?: string } | null) {
    if (res?.error) {
      setError(res.error);
    } else {
      setDone(true);
      setOpen(false);
      router.refresh();
    }
  }

  function asNew() {
    setError(null);
    start(async () =>
      finish(
        await importAttachment(projectId, messageId, attachmentId, filename, mimeType)
      )
    );
  }

  function asVersion() {
    if (!assetId) return;
    setError(null);
    start(async () =>
      finish(
        await importAttachmentAsVersion(
          projectId,
          assetId,
          messageId,
          attachmentId,
          filename,
          mimeType
        )
      )
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant={done ? "secondary" : "primary"}
        disabled={done}
        onClick={openModal}
      >
        {done ? "Imported" : "Add to assets"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add to assets">
        <div className="space-y-5">
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text">{filename}</span>
          </p>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-text-faint">
              As a new asset
            </div>
            <Button onClick={asNew} disabled={busy} className="w-full">
              {busy ? "Working..." : "Create new asset"}
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="text-xs font-bold uppercase tracking-wide text-text-faint">
              Or add as a new version of
            </div>
            {assets === null ? (
              <p className="text-sm text-text-faint">Loading assets...</p>
            ) : assets.length === 0 ? (
              <p className="text-sm text-text-faint">
                No existing assets in this project yet.
              </p>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                >
                  <option value="">Select an asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={asVersion}
                  disabled={busy || !assetId}
                >
                  Add version
                </Button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
