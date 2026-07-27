"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listMergeTargets,
  mergeAssetVersions,
} from "@/app/(app)/projects/[id]/actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// Fixes the common mix-up of uploading a new cut as its own file ("Spot v2")
// instead of a version of the original: folds this file's versions into
// another one, so the history and the review thread end up in one place.
export function MergeAssetModal({
  open,
  onClose,
  projectId,
  assetId,
  assetName,
  versionCount,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  assetId: string;
  assetName: string;
  versionCount: number;
}) {
  const [targets, setTargets] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let live = true;
    listMergeTargets(projectId, assetId).then((rows) => {
      if (live) setTargets(rows);
    });
    return () => {
      live = false;
    };
  }, [open, projectId, assetId]);

  async function submit() {
    if (!targetId) {
      setError("Pick the file this belongs to.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await mergeAssetVersions(assetId, targetId);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
  }

  const target = targets?.find((t) => t.id === targetId);

  return (
    <Modal open={open} onClose={onClose} title={`Make ${assetName} a version`}>
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Move this file&apos;s{" "}
          {versionCount === 1 ? "version" : `${versionCount} versions`} onto
          another file, so one file carries the whole history and one review
          thread. Comments and approvals move with it.
        </p>

        <div>
          <label
            htmlFor="merge-target"
            className="block text-xs font-semibold text-text-muted"
          >
            It belongs to
          </label>
          {targets === null ? (
            <p className="mt-2 text-sm text-text-faint">Loading files…</p>
          ) : targets.length === 0 ? (
            <p className="mt-2 text-sm text-text-faint">
              There is no other file in this project to merge into.
            </p>
          ) : (
            <select
              id="merge-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1.5 w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              <option value="">Choose a file…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {target && (
          <p className="rounded-[10px] bg-surface-2/60 px-3 py-2 text-xs text-text-muted">
            &quot;{assetName}&quot; is removed and its{" "}
            {versionCount === 1 ? "version becomes the next version" : "versions become the next versions"}{" "}
            of &quot;{target.name}&quot;. Any review link already sent for it
            keeps working and points at the merged file.
          </p>
        )}

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !targetId}>
            {busy ? "Merging…" : "Merge"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
