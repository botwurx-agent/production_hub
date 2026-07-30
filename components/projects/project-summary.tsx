"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/format";
import { summarizeProject } from "@/app/(app)/projects/[id]/ai-actions";
import { parseSummary } from "@/lib/summary-format";

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

  const parsed = parseSummary(content);

  return (
    <div>
      <div className={`transition ${busy ? "opacity-50" : ""}`}>
        {/* The opening status line is the twenty-second read, so it gets the
            weight and the full text colour. Everything below it is detail. */}
        {parsed.lead ? (
          <p className="text-[15px] font-medium leading-[1.6] text-text">
            {parsed.lead}
          </p>
        ) : null}

        {parsed.groups.length > 0 ? (
          <div className={parsed.lead ? "mt-5 space-y-5" : "space-y-5"}>
            {parsed.groups.map((group) => (
              <section key={group.label}>
                {/* A tinted chip with a dot, the same status vocabulary used
                    everywhere else, rather than a coloured row. */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{
                    backgroundColor: `var(--h-${group.hue}-bg)`,
                    color: `var(--h-${group.hue})`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: `var(--h-${group.hue})` }}
                  />
                  {group.label}
                </span>
                <ul className="mt-2.5 space-y-2">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-border-strong"
                      />
                      <span className="text-sm leading-[1.6] text-text">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {/* Anything the parser did not recognise is still shown, so a summary
            that drifts from the expected shape reads as prose rather than
            silently losing half of itself. */}
        {parsed.rest.length > 0 ? (
          <div
            className={`space-y-2 ${parsed.lead || parsed.groups.length ? "mt-5" : ""}`}
          >
            {parsed.rest.map((line, i) => (
              <p key={i} className="text-sm leading-[1.6] text-text-muted">
                {line}
              </p>
            ))}
          </div>
        ) : null}
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
