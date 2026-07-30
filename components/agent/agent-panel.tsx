"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ActionCard, type ClientCard } from "@/components/agent/action-card";
import { Dictation } from "@/components/agent/dictation";
import {
  loadAgentContext,
  loadAgentThread,
  type AgentContext,
} from "@/app/(app)/agent-actions";

// The panel keeps the thread id and the selected project for the browser
// session, so closing it and reopening it does not lose the conversation.
const THREAD_KEY = "agent.threadId";
const PROJECT_KEY = "agent.projectId";

type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "step"; text: string }
  | { kind: "card"; card: ClientCard }
  | { kind: "error"; text: string };

export function AgentPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<AgentContext | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // The project the producer is looking at is almost always the one they mean,
  // so a project page preselects itself. An explicit choice wins over the URL,
  // which is why the stored value is only used when the path has no project in
  // it.
  useEffect(() => {
    const fromPath = pathname.match(/^\/projects\/([0-9a-f-]{32,40})/i)?.[1];
    const stored = sessionStorage.getItem(PROJECT_KEY) ?? "";
    setProjectId(fromPath ?? stored);
    setThreadId(sessionStorage.getItem(THREAD_KEY));
  }, [pathname]);

  // Context and any saved conversation, once, on open.
  useEffect(() => {
    let alive = true;
    const stored = sessionStorage.getItem(THREAD_KEY);
    (async () => {
      const fromPath = pathname.match(/^\/projects\/([0-9a-f-]{32,40})/i)?.[1];
      const loaded = await loadAgentContext(
        fromPath ?? sessionStorage.getItem(PROJECT_KEY) ?? null
      );
      if (alive) setCtx(loaded);

      if (stored) {
        const history = await loadAgentThread(stored);
        if (!alive) return;
        const replayed: Entry[] = [];
        for (const m of history) {
          if (m.content.trim()) {
            replayed.push(
              m.role === "user"
                ? { kind: "user", text: m.content }
                : { kind: "assistant", text: m.content }
            );
          }
          if (Array.isArray(m.cards)) {
            for (const c of m.cards as ClientCard[]) {
              replayed.push({ kind: "card", card: c });
            }
          }
        }
        setEntries(replayed);
      }
    })();
    return () => {
      alive = false;
    };
    // Deliberately once: reloading the thread on every navigation would wipe
    // whatever is on screen mid-conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries, busy]);

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      setInput("");
      setEntries((prev) => [...prev, { kind: "user", text: question }]);
      setBusy(true);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: question,
            threadId: sessionStorage.getItem(THREAD_KEY),
            projectId: projectId || null,
          }),
        });

        if (!res.ok || !res.body) {
          const msg = await res
            .json()
            .then((j) => (j as { error?: string }).error)
            .catch(() => null);
          setEntries((prev) => [
            ...prev,
            { kind: "error", text: msg ?? "That did not go through." },
          ]);
          return;
        }

        // Newline-delimited JSON: one event per line, so a partial chunk is
        // held over rather than parsed as broken JSON.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            handleEvent(event);
          }
        }
      } catch {
        setEntries((prev) => [
          ...prev,
          { kind: "error", text: "The connection dropped before it finished." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId]
  );

  function handleEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case "thread": {
        const id = String(event.threadId ?? "");
        if (id) {
          sessionStorage.setItem(THREAD_KEY, id);
          setThreadId(id);
        }
        break;
      }
      case "step":
        setEntries((prev) => [
          ...prev,
          { kind: "step", text: String(event.label ?? "Working") },
        ]);
        break;
      case "text":
        setEntries((prev) => [
          ...prev,
          { kind: "assistant", text: String(event.text ?? "") },
        ]);
        break;
      case "card":
        setEntries((prev) => [
          ...prev,
          { kind: "card", card: event.card as ClientCard },
        ]);
        break;
      case "error":
        setEntries((prev) => [
          ...prev,
          { kind: "error", text: String(event.message ?? "Something went wrong.") },
        ]);
        break;
    }
  }

  function newThread() {
    sessionStorage.removeItem(THREAD_KEY);
    setThreadId(null);
    setEntries([]);
    boxRef.current?.focus();
  }

  function pickProject(id: string) {
    setProjectId(id);
    if (id) sessionStorage.setItem(PROJECT_KEY, id);
    else sessionStorage.removeItem(PROJECT_KEY);
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-border bg-bg shadow-lg"
      role="dialog"
      aria-label="Assistant"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent-soft text-accent">
          <SparkIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Assistant</p>
          <p className="truncate text-[11px] text-text-faint">
            Reads your studio. Asks before it changes anything.
          </p>
        </div>
        {threadId ? (
          <button
            type="button"
            onClick={newThread}
            className="rounded-[8px] px-2 py-1 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text"
          >
            New
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-[8px] px-2 py-1 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
        >
          &times;
        </button>
      </header>

      <div className="border-b border-border px-4 py-2">
        <label className="flex items-center gap-2 text-[11px] text-text-faint">
          Project
          <select
            value={projectId}
            onChange={(e) => pickProject(e.target.value)}
            className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface px-2 py-1 text-xs text-text"
          >
            <option value="">Whole studio</option>
            {(ctx?.projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {entries.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Ask about any job, the money, or what needs you. To change
              something, say it and confirm the card.
            </p>
            <div className="space-y-1.5">
              {(ctx?.suggestions ?? []).map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => ask(s.prompt)}
                  className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-left text-xs text-text hover:border-border-strong"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {entries.map((e, i) => (
          <EntryView key={i} entry={e} />
        ))}

        {busy ? (
          <p className="text-xs text-text-faint">
            <span className="animate-pulse">Thinking</span>
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          ask(input);
        }}
        className="border-t border-border p-3"
      >
        <div className="rounded-[10px] border border-border bg-surface focus-within:border-border-strong">
          <textarea
            ref={boxRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={2}
            placeholder="Ask, or say what to log..."
            className="w-full resize-none bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <Dictation
              onText={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  if (entry.kind === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-[12px] bg-accent-soft px-3 py-2 text-sm text-text">
          {entry.text}
        </p>
      </div>
    );
  }
  if (entry.kind === "assistant") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "step") {
    return (
      <p className="flex items-center gap-2 text-[11px] text-text-faint">
        <span className="h-1 w-1 rounded-pill bg-text-faint" />
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "card") {
    return <ActionCard card={entry.card} />;
  }
  return (
    <p className="rounded-[10px] bg-red-bg px-3 py-2 text-xs text-red">
      {entry.text}
    </p>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
