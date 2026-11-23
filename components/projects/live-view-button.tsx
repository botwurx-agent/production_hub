"use client";

// "Live view" on the project: start a Google Meet for a client who cannot be
// on set, join it, and hand out the link. The call is Google's and opens in
// its own tab; this only starts it and keeps the link on the project so
// nobody hunts for it mid-shoot. Staff only.
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
import {
  emailLiveView, removeLiveView, startLiveView, type LiveView,
} from "@/app/(app)/projects/[id]/live-view-actions";

function localDay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function LiveViewButton({
  projectId,
  projectTitle,
  initial,
  googleReady,
  emailEnabled,
}: {
  projectId: string;
  projectTitle: string;
  initial: LiveView | null;
  /** The viewer's own Google account is connected with Calendar allowed. */
  googleReady: boolean;
  emailEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<LiveView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const make = async (fresh: boolean) => {
    setBusy(true);
    const res = await startLiveView(projectId, {
      today: localDay(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fresh,
    });
    setBusy(false);
    const err = actionError(res);
    if (err || !res || !("url" in res)) { toast(err ?? "Could not start the live view.", "error"); return; }
    setView(res);
  };

  const copy = async () => {
    if (!view) return;
    try {
      await navigator.clipboard.writeText(view.url);
      toast("Link copied.");
    } catch {
      toast("Could not copy. Select the link and copy it by hand.", "error");
    }
  };

  const newLink = async () => {
    const ok = await confirmAction({
      title: "Make a new link?",
      body: "The project will point at a new call. Anyone you already sent the old link to will need the new one.",
      confirmLabel: "Make a new link",
    });
    if (ok) await make(true);
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: "Remove the live view?",
      body: "The link comes off this project and, where possible, off your Google Calendar. You can start a new one at any time.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setBusy(true);
    const err = actionError(await removeLiveView(projectId));
    setBusy(false);
    if (err) { toast(err, "error"); return; }
    setView(null);
  };

  return (
    <>
      <button
        type="button"
        data-live-view
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm transition hover:border-border-strong hover:text-text"
        title="A video call for clients watching the shoot remotely"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="6" width="13" height="12" rx="2" />
          <path d="m15 10 6-3v10l-6-3" />
        </svg>
        Live view
        {view ? <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden /> : null}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Live view">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            A Google Meet call for clients who cannot be on set. They watch the camera and talk with you, from a link.
            The call opens in its own browser tab.
          </p>

          {view ? (
            <>
              <a
                href={view.url}
                target="_blank"
                rel="noopener noreferrer"
                data-live-join
                className="flex items-center justify-center gap-2 rounded-[12px] bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-strong"
              >
                Join the call
              </a>
              <div className="flex gap-2">
                <input
                  readOnly
                  data-live-url
                  value={view.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void copy()} className="shrink-0 rounded-pill border border-border-strong px-4 py-2 text-sm font-semibold text-text hover:bg-surface-2">
                  Copy link
                </button>
              </div>
              {emailEnabled ? (
                <button type="button" onClick={() => setEmailOpen(true)} className="text-sm font-semibold text-accent hover:underline">
                  Email it to the client
                </button>
              ) : null}
              <ul className="space-y-1.5 rounded-[12px] border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-text">
                <li>
                  <span className="font-semibold">To show the camera:</span> in the call, open Settings, Video, and pick your
                  capture adapter (a Cam Link shows up as a camera).
                </li>
                <li>
                  <span className="font-semibold">Letting people in:</span>{" "}
                  {view.hostEmail ? `the call is hosted on ${view.hostEmail}, so that account admits guests.` : "the Google account that made the call admits guests."}
                </li>
                <li>
                  <span className="font-semibold">Length:</span> a free Gmail account may end a group call after an hour. A
                  Google Workspace account does not.
                </li>
              </ul>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs font-semibold">
                <button type="button" onClick={() => void newLink()} disabled={busy || !googleReady} className="text-text-muted hover:text-text disabled:opacity-50">
                  {busy ? "Working..." : "Make a new link"}
                </button>
                <button type="button" onClick={() => void remove()} disabled={busy} className="text-text-muted hover:text-red disabled:opacity-50">
                  Remove
                </button>
              </div>
            </>
          ) : googleReady ? (
            <>
              <button
                type="button"
                data-live-start
                disabled={busy}
                onClick={() => void make(false)}
                className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {busy ? "Starting..." : "Start live view"}
              </button>
              <p className="text-[13px] text-text-muted">
                This adds an entry called &quot;Live view: {projectTitle}&quot; to your Google Calendar today, which is where the Meet
                link comes from. The link stays on this project for every shoot day.
              </p>
            </>
          ) : (
            <p className="rounded-[12px] border border-border bg-surface-2 px-3.5 py-3 text-sm text-text">
              This uses your own Google account to make the call.{" "}
              <Link href="/settings" className="font-semibold text-accent hover:underline">
                Connect Google in Settings
              </Link>{" "}
              (with Calendar allowed), then come back here.
            </p>
          )}
        </div>
      </Modal>

      {emailOpen && view ? (
        <SendDocEmailModal
          open
          onClose={() => setEmailOpen(false)}
          title="Email the live view"
          defaultSubject={`${projectTitle}: watch the shoot live`}
          shareUrl={view.url}
          onSend={(input) => emailLiveView(projectId, { to: input.to, subject: input.subject, message: input.message })}
        />
      ) : null}
    </>
  );
}
