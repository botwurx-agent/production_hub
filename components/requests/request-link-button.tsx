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
  ensureRequestLink,
  revokeRequestLink,
  emailRequestLink,
} from "@/app/(app)/clients/request-actions";

/**
 * "Request link" on a client's page: one no-login link the client keeps and
 * uses for every new job. Creating it is a deliberate press, like the client
 * portal, so a link exists only once somebody meant to hand one out.
 */
export function RequestLinkButton({
  clientId,
  clientName,
  initialToken,
  defaultTo,
  emailEnabled,
}: {
  clientId: string;
  clientName: string;
  initialToken: string | null;
  defaultTo: string;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin = siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const url = token ? `${origin}/request/${token}` : "";

  function create() {
    start(async () => {
      const res = await ensureRequestLink(clientId);
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
      title: "Turn off the request link?",
      body: "The link stops working. Requests already sent stay on your pipeline, and turning it back on gives it a new address.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    start(async () => {
      const res = await revokeRequestLink(clientId);
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
        data-request-link-button
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text transition hover:border-border-strong"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 4h16v12H5.2L4 17.5z" />
          <path d="M12 7v6M9 10h6" />
        </svg>
        Request link
        {token && <span aria-label="on" className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--h-green)" }} />}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Request link">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            One link {clientName} keeps and uses for every new job. They say what
            they need, add a deadline, a budget and files, and it lands on your
            pipeline as a new inbound deal with the brief attached. No login
            needed.
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
                <span className="text-xs text-text-faint">Link is active</span>
                <button onClick={turnOff} disabled={busy} className="text-xs font-semibold text-red hover:underline disabled:opacity-50">
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <Button onClick={create} disabled={busy}>
              {busy ? "Working..." : "Create request link"}
            </Button>
          )}
        </div>
      </Modal>

      {emailOpen && (
        <SendDocEmailModal
          open
          onClose={() => setEmailOpen(false)}
          title="Email the request link"
          defaultTo={defaultTo}
          defaultSubject="Send us your next job"
          shareUrl={url}
          onSend={(input) => emailRequestLink(clientId, { to: input.to, subject: input.subject, message: input.message })}
        />
      )}
    </>
  );
}
