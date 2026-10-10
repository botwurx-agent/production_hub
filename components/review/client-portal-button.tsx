"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import {
  ensureClientPortal,
  revokeClientPortal,
  emailClientPortal,
} from "@/app/(app)/projects/[id]/portal-actions";

/**
 * "Client portal" on the Review page: one link for the client that lists
 * everything shared with them on this job. Creating it is a deliberate press
 * rather than something opening the window does, so a link only exists once
 * somebody meant to hand one out.
 */
export function ClientPortalButton({
  projectId,
  projectTitle,
  initialToken,
  sharedCount,
  emailEnabled,
}: {
  projectId: string;
  projectTitle: string;
  initialToken: string | null;
  sharedCount: number;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin =
    siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const url = token ? `${origin}/portal/${token}` : "";

  function create() {
    start(async () => {
      const res = await ensureClientPortal(projectId);
      const err = actionError(res);
      if (err || !("token" in res)) {
        toast(err ?? "Could not create the link.", "error");
        return;
      }
      setToken(res.token);
      router.refresh();
    });
  }

  async function turnOff() {
    const ok = await confirmAction({
      title: "Turn off the client portal?",
      body:
        "The portal link stops working. Each item's own review link keeps working, and turning the portal back on gives it a new address.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    start(async () => {
      const res = await revokeClientPortal(projectId);
      const err = actionError(res);
      if (err) {
        toast(err, "error");
        return;
      }
      setToken(null);
      router.refresh();
    });
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
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text transition hover:border-border-strong"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        Client portal
        {token && (
          <span
            aria-label="on"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--h-green)" }}
          />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Client portal">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            One link for the client with everything you have shared on this
            job: what is waiting on them, what is being changed, and what is
            approved. No login needed. Things you have not shared do not
            appear.
          </p>
          <p className="text-sm font-semibold text-text">
            {sharedCount === 0
              ? "Nothing is shared yet, so the portal would be empty. Share an item for review first."
              : `${sharedCount} ${sharedCount === 1 ? "item" : "items"} shared on this job.`}
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
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  Open what the client sees
                </a>
                {emailEnabled && (
                  <button
                    onClick={() => setEmailOpen(true)}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Email it to the client
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-text-faint">Link is active</span>
                <button
                  onClick={turnOff}
                  disabled={busy}
                  className="text-xs font-semibold text-red hover:underline disabled:opacity-50"
                >
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <Button onClick={create} disabled={busy}>
              {busy ? "Working..." : "Create portal link"}
            </Button>
          )}
        </div>
      </Modal>

      {emailOpen && (
        <SendDocEmailModal
          open
          onClose={() => setEmailOpen(false)}
          title="Email the client portal"
          defaultSubject={`${projectTitle}: everything for your review, in one place`}
          shareUrl={url}
          onSend={(input) =>
            emailClientPortal(projectId, {
              to: input.to,
              subject: input.subject,
              message: input.message,
            })
          }
        />
      )}
    </>
  );
}
