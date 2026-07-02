"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LinkEmailModal } from "@/components/projects/link-email-modal";
import { ImportAttachment } from "@/components/projects/import-attachment";
import { PlusIcon, EnvelopeIcon } from "@/components/app-shell/nav-icons";
import { fileSize, longDate, shortDate } from "@/lib/format";
import {
  getThreadMessages,
  unlinkThread,
  sendReply,
  type OwnerType,
} from "@/app/(app)/projects/[id]/email-actions";
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
    if (next && messages === null) loadMessages();
  }

  function send() {
    if (!reply.trim()) return;
    setSending(true);
    setReplyError(null);
    start(async () => {
      const res = await sendReply(thread.gmail_thread_id, reply, {
        projectId,
        revalidate,
      });
      setSending(false);
      if (res?.error) setReplyError(res.error);
      else {
        setReply("");
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
                    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                      {m.attachments.map((att) => (
                        <div
                          key={att.attachmentId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate text-text-muted">
                            {att.filename}
                            {att.size ? ` · ${fileSize(att.size)}` : ""}
                          </span>
                          {projectId ? (
                            <ImportAttachment
                              projectId={projectId}
                              messageId={m.id}
                              attachmentId={att.attachmentId}
                              filename={att.filename}
                              mimeType={att.mimeType}
                            />
                          ) : (
                            <span className="text-text-faint">
                              Import once this is a project
                            </span>
                          )}
                        </div>
                      ))}
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
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={send}
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? "Sending..." : "Send reply"}
                  </Button>
                </div>
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
