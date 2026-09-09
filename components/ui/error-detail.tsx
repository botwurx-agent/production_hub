"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  currentLocation,
  errorReport,
  errorSummary,
  type BoundaryError,
} from "@/lib/error-detail";

/**
 * The technical half of an error card: what broke, and a way to send it on.
 *
 * Shared by the two boundaries that render inside the root layout, so they
 * cannot drift. The global boundary replaces the document and has no access to
 * the stylesheet, so it inlines its own version of this.
 */
export function ErrorDetail({
  error,
  boundary,
}: {
  error: BoundaryError;
  /**
   * Which boundary drew this card. It rides in the copied report and in the
   * faint line below, because the three boundaries differ by one word of copy
   * and working out from a screenshot which one fired cost an afternoon once.
   */
  boundary: string;
}) {
  const [copied, setCopied] = useState(false);
  const summary = errorSummary(error);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        errorReport(error, `${boundary} ${currentLocation()}`),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard is not worth an error of its own
      // on a screen that is already reporting one.
      setCopied(false);
    }
  }

  if (!summary) return null;

  return (
    <div className="mt-4 rounded-[11px] border border-border bg-surface-2 px-3 py-2.5 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">
        What broke
      </p>
      {/* Selectable and wrapped rather than truncated: this line is the whole
          point of the card for anyone trying to fix it, and it is what a
          screenshot carries. */}
      <p className="mt-1 break-words font-mono text-xs leading-relaxed text-text-muted">
        {summary}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy details"}
        </Button>
        <span className="font-mono text-[10px] text-text-faint">{boundary}</span>
      </div>
    </div>
  );
}
