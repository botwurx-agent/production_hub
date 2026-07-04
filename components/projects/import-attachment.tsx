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
  getImportProjects,
} from "@/app/(app)/projects/[id]/email-actions";

export function ImportAttachment({
  projectId,
  messageId,
  attachmentId,
  filename,
  mimeType,
}: {
  projectId?: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // When there is no fixed project (lead/client conversation), the user picks one.
  const [projects, setProjects] = useState<
    { id: string; title: string }[] | null
  >(null);
  const [target, setTarget] = useState(projectId ?? "");
  const [assets, setAssets] = useState<{ id: string; name: string }[] | null>(
    null
  );
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();

  function loadAssets(pid: string) {
    setAssets(null);
    setAssetId("");
    start(async () => {
      const res = await getProjectAssets(pid);
      if ("error" in res) setError(res.error);
      else setAssets(res.assets);
    });
  }

  function openModal() {
    setOpen(true);
    setError(null);
    if (projectId) {
      if (assets === null) loadAssets(projectId);
    } else if (projects === null) {
      start(async () => {
        const res = await getImportProjects();
        if ("error" in res) setError(res.error);
        else setProjects(res.projects);
      });
    }
  }

  function onPickProject(pid: string) {
    setTarget(pid);
    if (pid) loadAssets(pid);
    else setAssets(null);
  }

  function finish(res: { error?: string } | null) {
    if (res?.error) setError(res.error);
    else {
      setDone(true);
      setOpen(false);
      router.refresh();
    }
  }

  function asNew() {
    if (!target) return;
    setError(null);
    start(async () =>
      finish(
        await importAttachment(target, messageId, attachmentId, filename, mimeType)
      )
    );
  }

  function asVersion() {
    if (!target || !assetId) return;
    setError(null);
    start(async () =>
      finish(
        await importAttachmentAsVersion(
          target,
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

          {!projectId && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-text-faint">
                Import into project
              </div>
              {projects === null ? (
                <p className="text-sm text-text-faint">Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="text-sm text-text-faint">
                  No projects yet. Start a project first.
                </p>
              ) : (
                <Select
                  value={target}
                  onChange={(e) => onPickProject(e.target.value)}
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {(projectId || target) && (
            <>
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
            </>
          )}

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
