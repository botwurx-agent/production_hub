"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/format";
import { summarizeProject } from "@/app/(app)/projects/[id]/ai-actions";

// Small "AI" spark mark for the summary card.
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

export function ProjectSummary({
  projectId,
  connected,
  initialContent,
  initialAt,
}: {
  projectId: string;
  connected: boolean;
  initialContent: string | null;
  initialAt: string | null;
}) {
  const [content, setContent] = useState<string | null>(initialContent);
  const [at, setAt] = useState<string | null>(initialAt);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const res = await summarizeProject(projectId);
      if ("error" in res) setError(res.error);
      else {
        setContent(res.content);
        setAt(res.createdAt);
      }
    });
  }

  if (!connected) {
    return (
      <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
        Add an OpenAI or Anthropic API key to the deployment to turn on AI
        summaries.
      </p>
    );
  }

  if (!content) {
    return (
      <div className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center">
        <span
          className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-[12px]"
          style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <SparkIcon className="h-5 w-5" />
        </span>
        <p className="mx-auto max-w-md text-sm text-text-muted">
          Get an instant read on where this project stands, drawn from the
          brief, assets, approvals, and recent activity.
        </p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={run} disabled={busy}>
            <SparkIcon /> {busy ? "Generating..." : "Generate summary"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 text-xs font-medium text-red">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`whitespace-pre-wrap text-sm leading-relaxed text-text-muted transition ${
          busy ? "opacity-50" : ""
        }`}
      >
        {content}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-xs text-text-faint">
          {busy
            ? "Refreshing..."
            : at
              ? `Updated ${shortDate(at)}`
              : ""}
        </span>
        <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
          <SparkIcon /> Refresh
        </Button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red">{error}</p>}
    </div>
  );
}
