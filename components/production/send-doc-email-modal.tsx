"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// Reusable "Send by email" dialog for any document surface (billing docs now,
// call sheets and others later). The parent supplies defaults + an onSend that
// performs the actual send and returns a result; this component owns the form.
export function SendDocEmailModal({
  open,
  onClose,
  title,
  defaultTo,
  defaultSubject,
  shareUrl,
  dueDateField = false,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  defaultTo?: string | null;
  defaultSubject: string;
  shareUrl?: string | null;
  dueDateField?: boolean;
  onSend: (input: {
    to: string;
    subject: string;
    message: string;
    dueDate?: string;
  }) => Promise<{ ok: true } | { error: string }>;
}) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await onSend({ to, subject, message, dueDate: dueDate || undefined });
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 1100);
  }

  function copy() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {sent ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-green text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <p className="text-sm font-semibold text-text">Sent</p>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">To</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@email.com"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">
              Message <span className="font-normal text-text-faint">(optional)</span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a short note for the client."
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </label>

          {dueDateField && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-text-muted">
                Respond by{" "}
                <span className="font-normal text-text-faint">(optional)</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
              <span className="mt-1 block text-[11px] text-text-faint">
                Shown to the client, and we&apos;ll auto-remind them if it passes.
              </span>
            </label>
          )}

          {error && <p className="text-xs font-semibold text-red">{error}</p>}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            {shareUrl ? (
              <button
                onClick={copy}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {copied ? "Link copied" : "Or copy a share link"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
