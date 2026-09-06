"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/format";
import { summarizeProject } from "@/app/(app)/projects/[id]/ai-actions";
import { parseSummary, splitTrailingNote } from "@/lib/summary-format";

// A per-person preference about a card, not studio state, so it lives in
// localStorage next to sidebar.collapsed and tasks.groupBy rather than in a
// migration. One key for every project: the question is "do I want the summary
// open", not "do I want it open on this job".
const STORAGE_KEY = "project.summary.open";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

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
  // Open is the default, since collapsed-by-default would hide the feature
  // from anyone who has never touched the control. Restored client-side only,
  // same as the sidebar, or the server and the client disagree on first paint.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== "0");
    } catch {}
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

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

  // ONE SHELL FOR EVERY STATE. The header carries the title, the AI mark and
  // the collapse control, and it used to live in the page that mounted this,
  // so a second page would have had to rebuild all three (and remember to).
  function Shell({ peek, children }: { peek?: string; children: React.ReactNode }) {
    return (
      <div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="group -mx-1 flex w-full items-center gap-2 rounded-[8px] px-1 py-1 text-left transition hover:bg-surface-2"
        >
          <h2 className="font-display text-base font-bold text-text">
            Project summary
          </h2>
          <span
            className="inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            AI
          </span>
          <span className="flex-1" />
          <span className="text-text-faint transition group-hover:text-text-muted">
            <Chevron open={open} />
          </span>
        </button>
        {/* Collapsed, the opening status line still shows. A folded card whose
            header says only "Project summary" is a dead row, and that sentence
            is the twenty-second read this card exists for. */}
        {!open && peek ? (
          <p className="mt-1 line-clamp-1 pr-1 text-sm text-text-muted">{peek}</p>
        ) : null}
        {open ? <div className="mt-4">{children}</div> : null}
      </div>
    );
  }

  if (!connected) {
    return (
      <Shell peek="AI summaries are off until a provider key is set.">
        <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
          Add an OpenAI or Anthropic API key to the deployment to turn on AI
          summaries.
        </p>
      </Shell>
    );
  }

  if (!content) {
    return (
      <Shell peek="No summary yet.">
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
      </Shell>
    );
  }

  const parsed = parseSummary(content);

  return (
    <Shell peek={parsed.lead || undefined}>
      <div className={`transition ${busy ? "opacity-50" : ""}`}>
        {/* The opening status line is the twenty-second read, so it gets the
            weight and the full text colour. Everything below it is detail. */}
        {parsed.lead ? (
          <p className="text-[15px] font-medium leading-[1.6] text-text">
            {parsed.lead}
          </p>
        ) : null}

        {/* A LABEL RAIL, not a stack. Five sections stacked vertically all
            look alike, so finding "Waiting on" meant reading from the top. In
            a left column the labels line up as five anchors the eye runs down
            in one pass, and the items align in one column beside them. Below
            sm there is no room for two columns, so it stacks. */}
        {parsed.groups.length > 0 ? (
          <div
            className={`divide-y divide-border border-t border-border ${
              parsed.lead ? "mt-5" : ""
            }`}
          >
            {parsed.groups.map((group) => (
              <section
                key={group.label}
                className="py-4 sm:grid sm:grid-cols-[132px_1fr] sm:gap-x-6"
              >
                {/* A tinted chip with a dot, the same status vocabulary used
                    everywhere else, rather than a coloured row. */}
                <span
                  // justify-self, or the grid stretches the pill to the full
                  // 132px rail and DONE trails an inch of empty tint.
                  className="inline-flex h-fit w-fit items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] sm:justify-self-start"
                  style={{
                    backgroundColor: `var(--h-${group.hue}-bg)`,
                    color: `var(--h-${group.hue})`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--h-${group.hue})` }}
                  />
                  {group.label}
                </span>
                <ul className="mt-2.5 space-y-2 sm:mt-0">
                  {group.items.map((item, i) => {
                    // The attribution recedes so the substance is what the eye
                    // lands on. It is still there, still readable, just not
                    // competing with the thing it is evidence for.
                    const { main, note } = splitTrailingNote(item);
                    return (
                      <li key={i} className="flex gap-2.5">
                        <span
                          aria-hidden
                          className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-border-strong"
                        />
                        <span className="text-sm leading-[1.6] text-text">
                          {main}
                          {note ? (
                            <span className="text-text-faint"> {note}</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
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
    </Shell>
  );
}
