"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LinkEmailModal } from "@/components/projects/link-email-modal";
import { ImportAttachment } from "@/components/projects/import-attachment";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { fileSize, longDate, shortDate } from "@/lib/format";
import {
  getThreadMessages,
  unlinkThread,
} from "@/app/(app)/projects/[id]/email-actions";
import type { ThreadMessage } from "@/lib/gmail";

export type LinkedThread = {
  id: string;
  gmail_thread_id: string;
  subject: string | null;
  last_message_at: string | null;
};

export function ThreadRow({
  thread,
  projectId,
}: {
  thread: LinkedThread;
  projectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && messages === null) {
      start(async () => {
        const res = await getThreadMessages(thread.gmail_thread_id);
        if ("error" in res) setError(res.error);
        else setMessages(res.messages);
      });
    }
  }

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button onClick={toggle} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-text">
            {thread.subject || "(no subject)"}
          </div>
          <div className="text-xs text-text-faint">
            {thread.last_message_at
              ? shortDate(thread.last_message_at)
              : "Email thread"}
          </div>
        </button>
        <button
          onClick={() =>
            start(() => unlinkThread(thread.id, projectId).then(() => router.refresh()))
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
                          <ImportAttachment
                            projectId={projectId}
                            messageId={m.id}
                            attachmentId={att.attachmentId}
                            filename={att.filename}
                            mimeType={att.mimeType}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectEmail({
  projectId,
  connected,
  defaultQuery,
  threads,
}: {
  projectId: string;
  connected: boolean;
  defaultQuery: string;
  threads: LinkedThread[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Connect Gmail in{" "}
        <Link href="/settings" className="font-semibold text-accent hover:underline">
          Settings
        </Link>{" "}
        to bring this project&apos;s email in here.
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
          No email linked yet. Link a Gmail thread to read it here and pull its
          attachments into assets.
        </p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} projectId={projectId} />
          ))}
        </div>
      )}

      <LinkEmailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        defaultQuery={defaultQuery}
      />
    </div>
  );
}
