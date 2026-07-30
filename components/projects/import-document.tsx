"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importAttachmentAsDocument } from "@/app/(app)/projects/[id]/email-actions";

/**
 * Files an email attachment into the project's Documents.
 *
 * One click, no modal, deliberately: the whole point is that filing paperwork
 * should cost less than leaving it in the inbox. Asking which project or what
 * to call it would put it back on a par with "I will deal with that later",
 * which is how the PDF ends up lost in a thread in the first place.
 *
 * Only shown on a thread that is already tied to a project, since a document
 * has to land somewhere.
 */
export function ImportDocument({
  projectId,
  messageId,
  attachmentId,
  filename,
  mimeType,
  from,
  subject,
  receivedAt,
}: {
  projectId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  from?: string;
  subject?: string | null;
  receivedAt?: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function file() {
    setError(null);
    start(async () => {
      const res = await importAttachmentAsDocument(
        projectId,
        messageId,
        attachmentId,
        filename,
        mimeType,
        { from, subject: subject ?? undefined, receivedAt }
      );
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <span className="text-[11px] font-semibold text-green">
        Filed to documents
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={file}
        disabled={busy}
        className="text-left text-[11px] font-semibold text-accent hover:underline disabled:opacity-60"
      >
        {busy ? "Filing..." : "Add to documents"}
      </button>
      {error ? <span className="text-[10px] text-red">{error}</span> : null}
    </span>
  );
}
