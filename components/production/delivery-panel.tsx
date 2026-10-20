"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { uploadDirect } from "@/components/upload/direct-upload";
import { actionError } from "@/lib/action-result";
import { fileSize } from "@/lib/format";
import { MAX_MEDIA_BYTES } from "@/lib/upload-limits";
import {
  addDeliverable,
  updateDeliverable,
  deleteDeliverable,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import {
  addDeliveryFiles,
  setDeliveryFileDeliverable,
  deleteDeliveryFile,
  getDeliveryFileUrl,
  ensureDeliveryLink,
  revokeDeliveryLink,
  emailDeliveryLink,
} from "@/app/(app)/projects/[id]/delivery-actions";
import type { Deliverable, DeliveryFile } from "@/lib/database.types";

const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";
const select =
  "rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold text-text";

const STAGES: Record<string, { label: string; dot: string }> = {
  pending: { label: "Not started", dot: "var(--h-amber)" },
  in_progress: { label: "In progress", dot: "var(--h-blue)" },
  delivered: { label: "Delivered", dot: "var(--h-green)" },
};

/**
 * Deliverables: the list of what the job ships (set at the start, staged as it
 * goes), then the job's final home, where the finished files live and from
 * which one link sends them all to the client to download.
 */
export function DeliveryPanel({
  projectId,
  projectTitle,
  deliverables,
  files,
  linkToken,
  canEdit,
  canSend,
  emailEnabled,
}: {
  projectId: string;
  projectTitle: string;
  deliverables: Deliverable[];
  files: DeliveryFile[];
  linkToken: string | null;
  /** False for a reviewer: RLS refuses the write anyway, so do not offer it. */
  canEdit: boolean;
  /** Sending to the client is the studio's act; collaborators do not see it. */
  canSend: boolean;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Deliverable[]>(deliverables);
  const sig = deliverables.map((d) => d.id).join(",");
  useEffect(() => {
    setRows(deliverables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("");

  function edit(id: string, patch: Partial<Deliverable>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function add() {
    start(async () => {
      await addDeliverable(projectId);
      router.refresh();
    });
  }
  async function del(r: Deliverable) {
    const count = files.filter((f) => f.deliverable_id === r.id).length;
    if (count > 0) {
      const ok = await confirmAction({
        title: `Delete "${r.name || "this deliverable"}"?`,
        body: `Its ${count} ${count === 1 ? "file stays" : "files stay"} on the page under Other files.`,
        confirmLabel: "Delete",
      });
      if (!ok) return;
    }
    setRows((p) => p.filter((x) => x.id !== r.id));
    start(async () => {
      await deleteDeliverable(projectId, r.id);
      router.refresh();
    });
  }

  async function upload(list: File[]) {
    if (!list.length) return;
    const done: { path: string; name: string; deliverableId: string | null }[] = [];
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setUploading(`Uploading ${f.name} (${i + 1} of ${list.length}, ${fileSize(f.size)})`);
      try {
        const up = await uploadDirect({ kind: "delivery_file", projectId }, f);
        done.push({ path: up.path, name: f.name, deliverableId: target || null });
      } catch (e) {
        failed.push(f.name);
        toast(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`, "error");
      }
    }
    if (done.length) {
      setUploading("Saving...");
      const res = await addDeliveryFiles(projectId, done);
      const err = actionError(res);
      if (err) toast(err, "error");
      else if ("added" in res) {
        failed.push(...res.failed);
        toast(`Added ${res.added} ${res.added === 1 ? "file" : "files"}.`);
      }
    }
    if (failed.length) toast(`Not added: ${failed.join(", ")}`, "error");
    setUploading(null);
    router.refresh();
  }

  const delivered = rows.filter((r) => r.status === "delivered").length;
  const groups: { id: string | null; name: string; files: DeliveryFile[] }[] = [
    ...rows.map((r) => ({
      id: r.id as string | null,
      name: r.name || "Untitled deliverable",
      files: files.filter((f) => f.deliverable_id === r.id),
    })),
    {
      id: null,
      name: "Other files",
      files: files.filter((f) => !f.deliverable_id || !rows.some((r) => r.id === f.deliverable_id)),
    },
  ].filter((g) => g.files.length > 0);

  return (
    <div className="space-y-10">
      {/* What the job ships */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text">What this job delivers</h2>
            <p className="text-sm text-text-muted">
              {rows.length === 0
                ? "List what ships to the client, and track the stage each one is at."
                : `${rows.length} deliverable${rows.length === 1 ? "" : "s"} · ${delivered} delivered`}
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={add} disabled={busy}>
              + Deliverable
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-muted">
            No deliverables yet. Add each one the client is getting, like an
            OLV :30, a :15 cutdown, or six social stills.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-[12px] border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="ml-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STAGES[r.status]?.dot ?? STAGES.pending.dot }}
                  />
                  <input
                    value={r.name}
                    disabled={!canEdit}
                    onChange={(e) => edit(r.id, { name: e.target.value })}
                    onBlur={() => updateDeliverable(projectId, r.id, { name: r.name })}
                    placeholder="Deliverable (e.g. OLV :30)"
                    className={`${cell} min-w-0 flex-1 font-semibold`}
                  />
                  <select
                    value={r.status}
                    disabled={!canEdit}
                    aria-label="Stage"
                    onChange={(e) => {
                      edit(r.id, { status: e.target.value });
                      updateDeliverable(projectId, r.id, { status: e.target.value });
                    }}
                    className={select}
                  >
                    {Object.entries(STAGES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <button
                      onClick={() => del(r)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                      aria-label="Delete deliverable"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-1 gap-2 pl-4 sm:grid-cols-2">
                  <input
                    value={r.spec ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => edit(r.id, { spec: e.target.value })}
                    onBlur={() => updateDeliverable(projectId, r.id, { spec: r.spec ?? "" })}
                    placeholder="Spec (1920x1080, ProRes, :30)"
                    className={cell}
                  />
                  <input
                    type="date"
                    value={r.due_date ?? ""}
                    disabled={!canEdit}
                    aria-label="Due date"
                    onChange={(e) => edit(r.id, { due_date: e.target.value })}
                    onBlur={() =>
                      updateDeliverable(projectId, r.id, { due_date: r.due_date || null })
                    }
                    className={cell}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* The final home */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text">Final files</h2>
            <p className="text-sm text-text-muted">
              The finished masters, where they live once the job ships.
              {files.length > 0 && ` ${files.length} ${files.length === 1 ? "file" : "files"}.`}
            </p>
          </div>
          {canSend && (
            <SendToClient
              projectId={projectId}
              projectTitle={projectTitle}
              initialToken={linkToken}
              fileCount={files.length}
              emailEnabled={emailEnabled}
            />
          )}
        </div>

        {canEdit ? (
          <FileDropzone
            onFiles={upload}
            maxBytes={MAX_MEDIA_BYTES}
            onTooLarge={(fs) => toast(`Over the 2GB limit: ${fs.map((f) => f.name).join(", ")}`, "error")}
            label="Drop to add final files"
            browse={{ text: "Drop the final files here" }}
            hint="Any file type, up to 2GB each"
            chooseLabel="Choose files"
            disabled={!!uploading}
            actions={
              rows.length > 0 ? (
                <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
                  For
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className={select}>
                    <option value="">No specific deliverable</option>
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name || "Untitled deliverable"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null
            }
          >
            {uploading && (
              <p className="mt-3 text-sm font-semibold text-text-muted">{uploading}</p>
            )}
          </FileDropzone>
        ) : null}

        <div className="mt-4 space-y-4">
          {groups.length === 0 ? (
            <p className="text-center text-sm text-text-muted">No final files yet.</p>
          ) : (
            groups.map((g) => (
              <div key={g.id ?? "loose"} className="rounded-[12px] border border-border">
                <p className="border-b border-border px-3 py-2 text-sm font-bold text-text">
                  {g.name}
                </p>
                <ul className="divide-y divide-border">
                  {g.files.map((f) => (
                    <FileRow
                      key={f.id}
                      projectId={projectId}
                      file={f}
                      deliverables={rows}
                      canEdit={canEdit}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function FileRow({
  projectId,
  file,
  deliverables,
  canEdit,
}: {
  projectId: string;
  file: DeliveryFile;
  deliverables: Deliverable[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function open(download: boolean) {
    start(async () => {
      const res = await getDeliveryFileUrl(file.id, download);
      const err = actionError(res);
      if (err || !("url" in res)) return toast(err ?? "Could not open the file.", "error");
      if (download) window.location.href = res.url;
      else window.open(res.url, "_blank", "noopener");
    });
  }
  function move(id: string) {
    start(async () => {
      const err = actionError(await setDeliveryFileDeliverable(projectId, file.id, id || null));
      if (err) toast(err, "error");
      router.refresh();
    });
  }
  async function remove() {
    const ok = await confirmAction({
      title: `Delete ${file.file_name}?`,
      body: "The file is removed from this project, and from the client's download link.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    start(async () => {
      const err = actionError(await deleteDeliveryFile(projectId, file.id));
      if (err) toast(err, "error");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
      <button
        onClick={() => open(false)}
        className="min-w-0 basis-full text-left sm:basis-0 sm:flex-1"
        title="Open"
      >
        <p className="truncate text-sm font-semibold text-text hover:underline">{file.file_name}</p>
        <p className="text-xs text-text-muted">
          {[fileSize(file.size_bytes), new Date(file.created_at).toLocaleDateString()].filter(Boolean).join(" · ")}
        </p>
      </button>
      {canEdit && deliverables.length > 0 && (
        <select
          value={file.deliverable_id ?? ""}
          onChange={(e) => move(e.target.value)}
          disabled={busy}
          aria-label="Deliverable"
          className={`${select} max-w-[12rem]`}
        >
          <option value="">Other files</option>
          {deliverables.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || "Untitled deliverable"}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => open(true)}
        disabled={busy}
        className="text-sm font-semibold text-accent hover:underline disabled:opacity-50"
      >
        Download
      </button>
      {canEdit && (
        <button
          onClick={remove}
          disabled={busy}
          className="text-sm font-semibold text-text-muted hover:text-red disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </li>
  );
}

/** One link for the client to download every final file. */
function SendToClient({
  projectId,
  projectTitle,
  initialToken,
  fileCount,
  emailEnabled,
}: {
  projectId: string;
  projectTitle: string;
  initialToken: string | null;
  fileCount: number;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin = site || (typeof window !== "undefined" ? window.location.origin : "");
  const url = token ? `${origin}/dl/${token}` : "";

  function create() {
    start(async () => {
      const res = await ensureDeliveryLink(projectId);
      const err = actionError(res);
      if (err || !("token" in res)) return toast(err ?? "Could not create the link.", "error");
      setToken(res.token);
      router.refresh();
    });
  }
  async function turnOff() {
    const ok = await confirmAction({
      title: "Turn off the download link?",
      body: "The client can no longer download from it. Turning it back on gives it a new address.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    start(async () => {
      const err = actionError(await revokeDeliveryLink(projectId));
      if (err) return toast(err, "error");
      setToken(null);
      router.refresh();
    });
  }
  function copy() {
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {token && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-green)" }} />
            Link is live
          </span>
        )}
        <Button onClick={() => setOpen(true)}>Send to client</Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Send the deliverables">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            One link where the client downloads every final file on this page,
            grouped by deliverable. No login needed. Files you add later show up
            on the same link.
          </p>
          <p className="text-sm font-semibold text-text">
            {fileCount === 0
              ? "No final files yet, so the link would be empty. Add the finals first."
              : `${fileCount} ${fileCount === 1 ? "file" : "files"} ready to download.`}
          </p>
          {token ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none"
                />
                <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:underline">
                  Open what the client sees
                </a>
                {emailEnabled && (
                  <button onClick={() => setEmailOpen(true)} className="text-sm font-semibold text-accent hover:underline">
                    Email it to the client
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-muted">Link is active</span>
                <button onClick={turnOff} disabled={busy} className="text-xs font-semibold text-red hover:underline disabled:opacity-50">
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <Button onClick={create} disabled={busy}>
              {busy ? "Working..." : "Create download link"}
            </Button>
          )}
        </div>
      </Modal>
      {emailOpen && (
        <SendDocEmailModal
          open
          onClose={() => setEmailOpen(false)}
          title="Email the deliverables"
          defaultSubject={`${projectTitle}: your final deliverables`}
          shareUrl={url}
          onSend={(input) =>
            emailDeliveryLink(projectId, { to: input.to, subject: input.subject, message: input.message })
          }
        />
      )}
    </>
  );
}
