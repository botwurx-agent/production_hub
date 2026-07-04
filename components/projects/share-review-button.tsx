"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  createReviewLink,
  revokeReviewLink,
} from "@/app/(app)/projects/[id]/share-actions";

// Share an asset for client review: create/copy/revoke a public review link.
export function ShareReviewButton({
  projectId,
  assetId,
  initialToken,
  linkId,
}: {
  projectId: string;
  assetId: string;
  initialToken: string | null;
  linkId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [id, setId] = useState<string | null>(linkId);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/r/${token}`
      : token
        ? `/r/${token}`
        : "";

  function ensureLink() {
    setError(null);
    start(async () => {
      const res = await createReviewLink(projectId, assetId);
      if ("error" in res) setError(res.error);
      else {
        setToken(res.token);
        router.refresh();
      }
    });
  }

  function openModal() {
    setOpen(true);
    if (!token) ensureLink();
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

  function revoke() {
    if (!id) return;
    setError(null);
    start(async () => {
      const res = await revokeReviewLink(projectId, id);
      if (res?.error) setError(res.error);
      else {
        setToken(null);
        setId(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-[9px] px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
        title="Share for client review"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Share for review">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Anyone with this link can preview the asset, comment, and approve or
            request changes. No login needed. Their feedback shows up here in the
            project.
          </p>

          {busy && !token ? (
            <p className="text-sm text-text-faint">Creating link...</p>
          ) : token ? (
            <>
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
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-faint">
                  Link is active
                </span>
                <button
                  onClick={revoke}
                  disabled={busy}
                  className="text-xs font-semibold text-red hover:underline disabled:opacity-50"
                >
                  Turn off link
                </button>
              </div>
            </>
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
