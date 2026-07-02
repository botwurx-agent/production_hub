"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { fileSize, longDate } from "@/lib/format";
import {
  searchSlackConversations,
  linkSlackChannel,
  unlinkSlackChannel,
  getSlackChannelMessages,
  importSlackFile,
  sendSlackMessage,
} from "@/app/(app)/projects/[id]/slack-actions";
import type { OwnerType } from "@/app/(app)/projects/[id]/email-actions";
import type { SlackConversationMatch, SlackMessage } from "@/lib/slack";

export type LinkedSlackChannel = {
  id: string;
  slack_channel_id: string;
  channel_name: string | null;
};

const OWNER_PATH: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

function slackTime(ts: string): string {
  const secs = parseFloat(ts);
  if (!secs) return "";
  return longDate(new Date(secs * 1000).toISOString());
}

function FileRow({
  projectId,
  channelId,
  file,
}: {
  projectId?: string;
  channelId: string;
  file: SlackMessage["files"][number];
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-text-muted">
        {file.name}
        {file.size ? ` · ${fileSize(file.size)}` : ""}
      </span>
      {projectId ? (
        <Button
          size="sm"
          variant={done ? "secondary" : "primary"}
          disabled={done || busy}
          onClick={() =>
            start(async () => {
              const res = await importSlackFile(
                projectId,
                channelId,
                file.urlPrivateDownload,
                file.name,
                file.mimetype
              );
              if (res?.error) setErr(res.error);
              else {
                setDone(true);
                router.refresh();
              }
            })
          }
        >
          {done ? "Imported" : busy ? "..." : "Add to assets"}
        </Button>
      ) : (
        <span className="text-text-faint">Import once this is a project</span>
      )}
      {err && <span className="text-red">{err}</span>}
    </div>
  );
}

export function SlackReader({
  channel,
  projectId,
  canSend = false,
  revalidate,
}: {
  channel: LinkedSlackChannel;
  projectId?: string;
  canSend?: boolean;
  revalidate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SlackMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function loadMessages() {
    start(async () => {
      const res = await getSlackChannelMessages(channel.slack_channel_id);
      if ("error" in res) setError(res.error);
      else setMessages(res.messages);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && messages === null) loadMessages();
  }

  function send() {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    start(async () => {
      const res = await sendSlackMessage(channel.slack_channel_id, draft, {
        revalidate,
      });
      setSending(false);
      if (res?.error) setSendError(res.error);
      else {
        setDraft("");
        loadMessages();
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button onClick={toggle} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-text">
            #{channel.channel_name || channel.slack_channel_id}
          </div>
          <div className="text-xs text-text-faint">Slack channel</div>
        </button>
        <button
          onClick={() =>
            start(() =>
              unlinkSlackChannel(channel.id, revalidate).then(() =>
                router.refresh()
              )
            )
          }
          className="shrink-0 rounded-[8px] p-1 text-text-faint transition hover:bg-red-bg hover:text-red"
          aria-label="Unlink channel"
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
            <p className="text-xs text-text-faint">Loading channel...</p>
          ) : error ? (
            <p className="text-xs font-medium text-red">{error}</p>
          ) : (
            <ol className="space-y-3">
              {(messages ?? []).map((m) => (
                <li key={m.ts} className="rounded-[10px] bg-surface-2/50 p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-text">
                      {m.author}
                    </span>
                    <span className="text-xs text-text-faint">
                      {slackTime(m.ts)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                    {m.text}
                  </p>
                  {m.files.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                      {m.files.map((f) => (
                        <FileRow
                          key={f.id}
                          projectId={projectId}
                          channelId={channel.slack_channel_id}
                          file={f}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {messages !== null &&
            (canSend ? (
              <div className="mt-3 border-t border-border pt-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message this channel... (posts to Slack as you)"
                  className="min-h-[64px]"
                />
                {sendError && (
                  <p className="mt-1 text-xs font-medium text-red">
                    {sendError}
                  </p>
                )}
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={send}
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? "Sending..." : "Send to Slack"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-faint">
                Reconnect Slack in{" "}
                <Link href="/settings" className="font-semibold text-accent hover:underline">
                  Settings
                </Link>{" "}
                to send messages from here.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function LinkSlackModal({
  open,
  onClose,
  ownerType,
  ownerId,
}: {
  open: boolean;
  onClose: () => void;
  ownerType: OwnerType;
  ownerId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SlackConversationMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [linked, setLinked] = useState<Set<string>>(new Set());

  function run(q: string) {
    setError(null);
    start(async () => {
      const res = await searchSlackConversations(q);
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else setResults(res.matches);
    });
  }

  // List all conversations on open so they can browse or type to filter.
  useEffect(() => {
    if (open) {
      setQuery("");
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function link(m: SlackConversationMatch) {
    start(async () => {
      const res = await linkSlackChannel(
        ownerType,
        ownerId,
        m.channelId,
        m.channelName
      );
      if (res?.error) setError(res.error);
      else {
        setLinked((p) => new Set(p).add(m.channelId));
        router.refresh();
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Link a Slack channel">
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter your channels and DMs by name"
            autoFocus
          />
          <Button type="submit" disabled={busy}>
            {busy ? "..." : "Search"}
          </Button>
        </form>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {results === null ? null : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-faint">
              No matching channels.
            </p>
          ) : (
            results.map((m) => {
              const isLinked = linked.has(m.channelId);
              return (
                <div
                  key={m.channelId}
                  className="flex items-start justify-between gap-3 rounded-[12px] border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text">
                      #{m.channelName}
                    </div>
                    <div className="line-clamp-2 text-xs text-text-faint">
                      {m.snippet}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isLinked ? "secondary" : "primary"}
                    disabled={isLinked || busy}
                    onClick={() => link(m)}
                  >
                    {isLinked ? "Linked" : "Link"}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function SlackPanel({
  ownerType,
  ownerId,
  connected,
  canSend = false,
  channels,
  projectId,
}: {
  ownerType: OwnerType;
  ownerId: string;
  connected: boolean;
  canSend?: boolean;
  channels: LinkedSlackChannel[];
  projectId?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const revalidate = `${OWNER_PATH[ownerType]}/${ownerId}`;

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Connect Slack in{" "}
        <Link href="/settings" className="font-semibold text-accent hover:underline">
          Settings
        </Link>{" "}
        to bring channels in here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          <PlusIcon /> Link channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-faint">
          No Slack channel linked yet.
        </p>
      ) : (
        <div className="space-y-2">
          {channels.map((c) => (
            <SlackReader
              key={c.id}
              channel={c}
              projectId={projectId}
              canSend={canSend}
              revalidate={revalidate}
            />
          ))}
        </div>
      )}

      <LinkSlackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ownerType={ownerType}
        ownerId={ownerId}
      />
    </div>
  );
}
