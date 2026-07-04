"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { draftOutreach } from "@/app/(app)/leads/[id]/ai-actions";
import { sendReply } from "@/app/(app)/projects/[id]/email-actions";
import { sendSlackMessage } from "@/app/(app)/projects/[id]/slack-actions";
import { sendChatMessage } from "@/app/(app)/projects/[id]/gchat-actions";
import type { UpdateDestination } from "@/components/projects/client-update";

function SendIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

export function OutreachDraft({
  leadId,
  connected,
  destinations,
}: {
  leadId: string;
  connected: boolean;
  destinations: UpdateDestination[];
}) {
  const [draft, setDraft] = useState("");
  const [busy, start] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const revalidate = `/leads/${leadId}`;

  function generate() {
    setError(null);
    setSentTo(null);
    start(async () => {
      const res = await draftOutreach(leadId);
      if ("error" in res) setError(res.error);
      else setDraft(res.draft);
    });
  }

  function send(dest: UpdateDestination) {
    if (!draft.trim()) return;
    setError(null);
    setSentTo(null);
    setSendingId(dest.id);
    start(async () => {
      let res: { error?: string } | null = null;
      if (dest.kind === "email") {
        res = await sendReply(dest.gmailThreadId, draft, { revalidate });
      } else if (dest.kind === "slack") {
        res = await sendSlackMessage(dest.channelId, draft, { revalidate });
      } else {
        res = await sendChatMessage(dest.spaceName, draft, { revalidate });
      }
      setSendingId(null);
      if (res?.error) setError(res.error);
      else setSentTo(dest.label);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Add an OpenAI or Anthropic API key to the deployment to draft outreach.
      </p>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center">
        <span
          className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-[12px]"
          style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <SendIcon className="h-5 w-5" />
        </span>
        <p className="mx-auto max-w-md text-sm text-text-muted">
          Draft a short outreach or follow-up note to this prospect from what
          you know so far. You can edit it before sending.
        </p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy ? "Drafting..." : "Draft outreach"}
          </Button>
        </div>
        {error && <p className="mt-3 text-xs font-medium text-red">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[180px]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={generate} disabled={busy}>
          {busy && !sendingId ? "Redrafting..." : "Redraft"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={copy}
          disabled={!draft.trim()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {destinations.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-xs font-semibold text-text-faint">
            Send to this lead
          </div>
          <div className="flex flex-wrap gap-2">
            {destinations.map((d) => (
              <Button
                key={d.id}
                size="sm"
                onClick={() => send(d)}
                disabled={busy || !draft.trim()}
              >
                <SendIcon />
                {sendingId === d.id ? "Sending..." : d.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-text-faint">
          Link a Gmail thread, Slack channel, or Google Chat space to this lead
          to send from here. For now, use Copy.
        </p>
      )}

      {sentTo && (
        <p
          className="mt-2 text-xs font-medium"
          style={{ color: "var(--h-green)" }}
        >
          Sent to {sentTo}.
        </p>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red">{error}</p>}
    </div>
  );
}
