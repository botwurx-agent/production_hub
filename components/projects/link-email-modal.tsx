"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchGmailThreads,
  linkThread,
} from "@/app/(app)/projects/[id]/email-actions";
import type { ThreadSummary } from "@/lib/gmail";

export function LinkEmailModal({
  open,
  onClose,
  projectId,
  defaultQuery,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<ThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startSearch] = useTransition();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());

  function run(q: string) {
    setError(null);
    startSearch(async () => {
      const res = await searchGmailThreads(q);
      if ("error" in res) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(res.threads);
      }
    });
  }

  // Auto-search when opened.
  useEffect(() => {
    if (open) {
      setQuery(defaultQuery);
      run(defaultQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function link(t: ThreadSummary) {
    setLinkingId(t.gmailThreadId);
    startSearch(async () => {
      const res = await linkThread(projectId, t.gmailThreadId, t.subject, t.dateMs);
      setLinkingId(null);
      if (res?.error) {
        setError(res.error);
      } else {
        setLinked((prev) => new Set(prev).add(t.gmailThreadId));
        router.refresh();
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Link an email thread">
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
            placeholder="Search Gmail (sender, subject, keywords)"
            autoFocus
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Search"}
          </Button>
        </form>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="max-h-[380px] space-y-2 overflow-y-auto">
          {results === null ? null : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-faint">
              No matching emails.
            </p>
          ) : (
            results.map((t) => {
              const isLinked = linked.has(t.gmailThreadId);
              return (
                <div
                  key={t.gmailThreadId}
                  className="rounded-[12px] border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text">
                        {t.subject}
                      </div>
                      <div className="truncate text-xs text-text-muted">
                        {t.from}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-text-faint">
                        {t.snippet}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isLinked ? "secondary" : "primary"}
                      disabled={isLinked || linkingId === t.gmailThreadId}
                      onClick={() => link(t)}
                    >
                      {isLinked
                        ? "Linked"
                        : linkingId === t.gmailThreadId
                          ? "..."
                          : "Link"}
                    </Button>
                  </div>
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
