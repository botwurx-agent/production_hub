"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LinkEmailModal } from "@/components/projects/link-email-modal";
import { ImportAttachment } from "@/components/projects/import-attachment";
import { AttachmentCard } from "@/components/attachments/attachment-card";
import {
  DrivePickerModal,
  type PickedDriveFile,
} from "@/components/projects/drive-browser";
import { PlusIcon, EnvelopeIcon } from "@/components/app-shell/nav-icons";
import { longDate, shortDate } from "@/lib/format";
import {
  getThreadMessages,
  unlinkThread,
  markThreadRead,
  getProjectAssets,
  sendReplyWithFiles,
  type OwnerType,
} from "@/app/(app)/projects/[id]/email-actions";
import { COMMS_READ_EVENT } from "@/components/app-shell/communication-badge";
import type { ThreadMessage } from "@/lib/gmail";

export type LinkedThread = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  last_message_at: string | null;
};

const OWNER_PATH: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

// Reads a linked email thread inline, with reply and (for projects) import.
// projectId enables attachment import; revalidate is the page to refresh.
export function ThreadReader({
  thread,
  canSend = false,
  projectId,
  revalidate,
}: {
  thread: LinkedThread;
  canSend?: boolean;
  projectId?: string;
  revalidate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [assetOpts, setAssetOpts] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveFiles, setDriveFiles] = useState<PickedDriveFile[]>([]);
  const [driveOpen, setDriveOpen] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }
  function toggleDriveFile(f: PickedDriveFile) {
    setDriveFiles((prev) =>
      prev.some((x) => x.id === f.id)
        ? prev.filter((x) => x.id !== f.id)
        : [...prev, f]
    );
  }

  function loadAssetOpts() {
    if (!projectId) return;
    start(async () => {
      const res = await getProjectAssets(projectId);
      if (!("error" in res)) setAssetOpts(res.assets);
    });
  }

  function toggleAttach(id: string) {
    setAttachIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function loadMessages() {
    start(async () => {
      const res = await getThreadMessages(thread.gmail_thread_id);
      if ("error" in res) setError(res.error);
      else setMessages(res.messages);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (messages === null) loadMessages();
      // Opening it here clears it from the Communication badge.
      markThreadRead(thread.id)
        .then(() => window.dispatchEvent(new Event(COMMS_READ_EVENT)))
        .catch(() => {});
    }
  }

  function send() {
    if (!reply.trim()) return;
    setSending(true);
    setReplyError(null);
    const fd = new FormData();
    fd.set("threadId", thread.gmail_thread_id);
    fd.set("body", reply);
    if (projectId) fd.set("projectId", projectId);
    if (revalidate) fd.set("revalidate", revalidate);
    fd.set("assetIds", JSON.stringify(attachIds));
    fd.set("driveFiles", JSON.stringify(driveFiles));
    for (const f of files) fd.append("files", f);
    start(async () => {
      const res = await sendReplyWithFiles(fd);
      setSending(false);
      if (res?.error) setReplyError(res.error);
      else {
        setReply("");
        setAttachIds([]);
        setAttachOpen(false);
        setFiles([]);
        setDriveFiles([]);
        loadMessages();
        router.refresh();
      }
    });
  }

  return (
    <div
      className="overflow-hidden rounded-[12px] border border-border bg-surface transition hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
      style={{ borderLeft: "3px solid var(--h-blue)" }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ backgroundColor: "var(--h-blue-bg)", color: "var(--h-blue)" }}
          >
            <EnvelopeIcon />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-text">
              {thread.subject || "(no subject)"}
            </span>
            <span
              className="block text-xs font-medium"
              style={{ color: "var(--h-blue)" }}
            >
              Email
              <span className="text-text-faint">
                {thread.last_message_at
                  ? `  ·  ${shortDate(thread.last_message_at)}`
                  : ""}
              </span>
            </span>
          </span>
        </button>
        <button
          onClick={() =>
            start(() =>
              unlinkThread(thread.id, revalidate).then(() => router.refresh())
            )
          }
          className="shrink-0 rounded-[8px] p-1 text-text-faint transition hover:bg-red-bg hover:text-red"
          aria-label="Unlink thread"
          title="Unlink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-3">
          {loading && messages === null ? (
            <p className="text-xs text-text-faint">Loading thread...</p>
          ) : error ? (
            <p className="text-xs font-medium text-red">{error}</p>
          ) : (
            <ol className="space-y-3">
              {(messages ?? []).map((m) => (
                <li key={m.id} className="rounded-[10px] bg-surface-2/50 p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-text">
                      {m.from}
                    </span>
                    <span className="text-xs text-text-faint">
                      {m.dateMs ? longDate(new Date(m.dateMs).toISOString()) : m.date}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-text-muted line-clamp-[12]">
                    {m.bodyText}
                  </p>
                  {m.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 sm:grid-cols-3">
                      {m.attachments.map((att) => {
                        const base = `/api/attachments/gmail?message=${encodeURIComponent(m.id)}&attachment=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}&mime=${encodeURIComponent(att.mimeType)}`;
                        return (
                          <AttachmentCard
                            key={att.attachmentId}
                            name={att.filename}
                            mime={att.mimeType}
                            size={att.size}
                            previewUrl={`${base}&disp=inline`}
                            downloadUrl={base}
                          >
                            <ImportAttachment
                              projectId={projectId}
                              messageId={m.id}
                              attachmentId={att.attachmentId}
                              filename={att.filename}
                              mimeType={att.mimeType}
                            />
                          </AttachmentCard>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {messages !== null &&
            (canSend ? (
              <div className="mt-3 border-t border-border pt-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply... (sends from your connected Gmail, stays in this thread)"
                  className="min-h-[72px]"
                />
                {replyError && (
                  <p className="mt-1 text-xs font-medium text-red">
                    {replyError}
                  </p>
                )}
                {projectId && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachOpen((o) => !o);
                        if (assetOpts === null) loadAssetOpts();
                      }}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      {attachOpen ? "Hide assets" : "Attach asset"}
                    </button>
                    {attachOpen && (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded-[10px] border border-border p-1">
                        {assetOpts === null ? (
                          <p className="px-2 py-1 text-xs text-text-faint">
                            Loading assets...
                          </p>
                        ) : assetOpts.length === 0 ? (
                          <p className="px-2 py-1 text-xs text-text-faint">
                            No assets in this project.
                          </p>
                        ) : (
                          assetOpts.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggleAttach(a.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1 text-left text-xs transition hover:bg-surface-2"
                            >
                              <span className="truncate text-text">{a.name}</span>
                              {attachIds.includes(a.id) && (
                                <span className="text-accent">&#10003;</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {attachIds.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {attachIds.map((id) => {
                          const a = assetOpts?.find((x) => x.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-text"
                            >
                              {a?.name ?? "asset"}
                              <button
                                type="button"
                                onClick={() => toggleAttach(id)}
                                className="text-text-faint hover:text-red"
                                aria-label="Remove attachment"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {files.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] text-accent"
                      >
                        {f.name}
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-accent/70 hover:text-red"
                          aria-label="Remove file"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {driveFiles.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {driveFiles.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-text"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M8.4 3.5h7.2l6.4 11.1-3.6 6.2H5.6L2 14.6 8.4 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                        {f.name}
                        <button
                          type="button"
                          onClick={() => toggleDriveFile(f)}
                          className="text-text-faint hover:text-red"
                          aria-label="Remove Drive file"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      Attach file
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriveOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M8.4 3.5h7.2l6.4 11.1-3.6 6.2H5.6L2 14.6 8.4 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      </svg>
                      Attach from Drive
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={send}
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? "Sending..." : "Send reply"}
                  </Button>
                </div>
                <DrivePickerModal
                  open={driveOpen}
                  onClose={() => setDriveOpen(false)}
                  mode="select"
                  selectedIds={new Set(driveFiles.map((f) => f.id))}
                  onToggle={toggleDriveFile}
                />
              </div>
            ) : (
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-faint">
                Reconnect Gmail in{" "}
                <Link href="/settings" className="font-semibold text-accent hover:underline">
                  Settings
                </Link>{" "}
                to reply from here.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

// Owner-agnostic email panel: link + read + reply, on a project, lead or client.
export function EmailPanel({
  ownerType,
  ownerId,
  connected,
  canSend = false,
  defaultQuery,
  threads,
  projectId,
}: {
  ownerType: OwnerType;
  ownerId: string;
  connected: boolean;
  canSend?: boolean;
  defaultQuery: string;
  threads: LinkedThread[];
  projectId?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const revalidate = `${OWNER_PATH[ownerType]}/${ownerId}`;

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Connect Gmail in{" "}
        <Link href="/settings" className="font-semibold text-accent hover:underline">
          Settings
        </Link>{" "}
        to bring this {ownerType}&apos;s email in here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          <PlusIcon /> Link email
        </Button>
      </div>

      {threads.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-faint">
          No email linked yet. Link a Gmail thread to read and reply here.
        </p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <ThreadReader
              key={t.id}
              thread={t}
              canSend={canSend}
              projectId={projectId}
              revalidate={revalidate}
            />
          ))}
        </div>
      )}

      <LinkEmailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ownerType={ownerType}
        ownerId={ownerId}
        defaultQuery={defaultQuery}
      />
    </div>
  );
}
