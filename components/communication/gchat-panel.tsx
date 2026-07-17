"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PlusIcon, ChatIcon } from "@/components/app-shell/nav-icons";
import { longDate } from "@/lib/format";
import {
  searchChatSpaces,
  getChatSpaceMessages,
  linkChatSpace,
  unlinkChatSpace,
  sendChatMessage,
  markSpaceRead,
} from "@/app/(app)/projects/[id]/gchat-actions";
import { COMMS_READ_EVENT } from "@/components/app-shell/communication-badge";
import type { OwnerType } from "@/app/(app)/projects/[id]/email-actions";
import type { ChatSpaceMatch, ChatMessage } from "@/lib/googlechat";

export type LinkedChatSpace = {
  id: string;
  space_name: string;
  space_display_name: string | null;
};

const OWNER_PATH: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

export function ChatReader({
  space,
  canSend = false,
  revalidate,
  unread = 0,
}: {
  space: LinkedChatSpace;
  canSend?: boolean;
  revalidate: string;
  unread?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function loadMessages() {
    start(async () => {
      const res = await getChatSpaceMessages(space.space_name);
      if ("error" in res) setError(res.error);
      else setMessages(res.messages);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (messages === null) loadMessages();
      // Opening it here clears it from the Communication badge.
      markSpaceRead(space.id)
        .then(() => window.dispatchEvent(new Event(COMMS_READ_EVENT)))
        .catch(() => {});
    }
  }

  function send() {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    start(async () => {
      const res = await sendChatMessage(space.space_name, draft, { revalidate });
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
    <div
      className="overflow-hidden rounded-[12px] border border-border bg-surface transition hover:-translate-y-px hover:border-border-strong hover:shadow-sm"
      style={{ borderLeft: "3px solid var(--h-cyan)" }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ backgroundColor: "var(--h-cyan-bg)", color: "var(--h-cyan)" }}
          >
            <ChatIcon />
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate text-sm text-text ${unread > 0 ? "font-bold" : "font-semibold"}`}
            >
              {space.space_display_name || "Google Chat space"}
            </span>
            <span
              className="block text-xs font-medium"
              style={{ color: "var(--h-cyan)" }}
            >
              Google Chat
            </span>
          </span>
        </button>
        {unread > 0 && (
          <span
            className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-accent-fg"
            aria-label={`${unread} new`}
            title={`${unread} new message${unread === 1 ? "" : "s"}`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <button
          onClick={() =>
            start(() =>
              unlinkChatSpace(space.id, revalidate).then(() => router.refresh())
            )
          }
          className="shrink-0 rounded-[8px] p-1 text-text-faint transition hover:bg-red-bg hover:text-red"
          aria-label="Unlink space"
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
            <p className="text-xs text-text-faint">Loading space...</p>
          ) : error ? (
            <p className="text-xs font-medium text-red">{error}</p>
          ) : (
            <ol className="space-y-3">
              {(messages ?? []).map((m) => (
                <li key={m.name} className="rounded-[10px] bg-surface-2/50 p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-text">
                      {m.author}
                    </span>
                    <span className="text-xs text-text-faint">
                      {m.createTime ? longDate(m.createTime) : ""}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                    {m.text}
                  </p>
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
                  placeholder="Message this space... (posts to Google Chat as you)"
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
                    {sending ? "Sending..." : "Send to Chat"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-faint">
                Reconnect Google in{" "}
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

function LinkChatModal({
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
  const [results, setResults] = useState<ChatSpaceMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [linked, setLinked] = useState<Set<string>>(new Set());

  function run(q: string) {
    setError(null);
    start(async () => {
      const res = await searchChatSpaces(q);
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else setResults(res.matches);
    });
  }

  // List all spaces on open so they can browse or type to filter.
  useEffect(() => {
    if (open) {
      setQuery("");
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function link(m: ChatSpaceMatch) {
    start(async () => {
      const res = await linkChatSpace(
        ownerType,
        ownerId,
        m.spaceName,
        m.displayName
      );
      if (res?.error) setError(res.error);
      else {
        setLinked((p) => new Set(p).add(m.spaceName));
        router.refresh();
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Link a Google Chat space">
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
            placeholder="Filter your spaces by name"
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
              No matching spaces.
            </p>
          ) : (
            results.map((m) => {
              const isLinked = linked.has(m.spaceName);
              return (
                <div
                  key={m.spaceName}
                  className="flex items-start justify-between gap-3 rounded-[12px] border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text">
                      {m.displayName}
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

export function ChatPanel({
  ownerType,
  ownerId,
  connected,
  canSend = false,
  spaces,
}: {
  ownerType: OwnerType;
  ownerId: string;
  connected: boolean;
  canSend?: boolean;
  spaces: LinkedChatSpace[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const revalidate = `${OWNER_PATH[ownerType]}/${ownerId}`;

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Connect Google in{" "}
        <Link href="/settings" className="font-semibold text-accent hover:underline">
          Settings
        </Link>{" "}
        (with Chat access) to bring spaces in here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
          <PlusIcon /> Link space
        </Button>
      </div>

      {spaces.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-faint">
          No Google Chat space linked yet.
        </p>
      ) : (
        <div className="space-y-2">
          {spaces.map((s) => (
            <ChatReader
              key={s.id}
              space={s}
              canSend={canSend}
              revalidate={revalidate}
            />
          ))}
        </div>
      )}

      <LinkChatModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ownerType={ownerType}
        ownerId={ownerId}
      />
    </div>
  );
}
