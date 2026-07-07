"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { createDocReviewLink } from "@/app/(app)/projects/[id]/share-actions";

type DocKind = "shot_list" | "storyboard" | "moodboard";

const NOUN: Record<DocKind, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
};

// Share a doc surface (shot list / storyboard / moodboard) for client review:
// creates (or reuses) a public link that renders the live doc with pins.
export function ShareDocButton({
  projectId,
  kind,
  targetId,
  disabled = false,
}: {
  projectId: string;
  kind: DocKind;
  targetId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin =
    siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const url = token ? `${origin}/r/${token}` : "";

  function ensureLink() {
    setError(null);
    start(async () => {
      const res = await createDocReviewLink(projectId, kind, targetId);
      if ("error" in res) setError(res.error);
      else {
        setToken(res.token);
        router.refresh();
      }
    });
  }

  function openModal() {
    setOpen(true);
    setToken(null);
    ensureLink();
  }

  function copy() {
    if (!url) return;
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
      <button
        onClick={openModal}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text disabled:opacity-40"
        title={`Share ${NOUN[kind]} for client review`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share for review
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Share ${NOUN[kind]}`}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Anyone with this link can view the live {NOUN[kind]}, drop pinned
            comments, and approve or request changes. No login needed. Their
            feedback shows up here in the project.
          </p>

          {busy && !token ? (
            <p className="text-sm text-text-faint">Creating link...</p>
          ) : token ? (
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none"
              />
              <Button onClick={copy} disabled={!url}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <Button onClick={ensureLink} disabled={busy}>
              {busy ? "Working..." : "Create review link"}
            </Button>
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
