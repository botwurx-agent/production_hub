"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveProject,
  unarchiveProject,
} from "@/app/(app)/projects/actions";

// Archive / unarchive a project. Archiving is non-destructive (keeps all data);
// it just hides the project from the active board + dashboard.
export function ArchiveProjectButton({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();

  function doArchive() {
    start(async () => {
      await archiveProject(projectId);
      router.push("/projects");
      router.refresh();
    });
  }
  function doUnarchive() {
    start(async () => {
      await unarchiveProject(projectId);
      router.refresh();
    });
  }

  if (archived) {
    return (
      <button
        onClick={doUnarchive}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.5 2.8L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        {busy ? "Restoring…" : "Unarchive"}
      </button>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Archive this project?</span>
        <button
          onClick={doArchive}
          disabled={busy}
          className="rounded-[9px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Archiving…" : "Archive"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-semibold text-text-faint hover:text-text"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title="Archive this project (hides it from the active board; nothing is deleted)"
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
      </svg>
      Archive
    </button>
  );
}
