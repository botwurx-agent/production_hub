"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { currentLocation, errorReport, errorSummary } from "@/lib/error-detail";

// Last-resort boundary: catches errors in the root layout itself. It replaces
// the entire document, so it must render its own <html>/<body> and cannot rely
// on the app's global stylesheet. Styles are inlined and theme-aware, and the
// fault block below is a hand-rolled copy of components/ui/error-detail for the
// same reason: no tokens, no shared components, nothing but this file.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const summary = errorSummary(error);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        errorReport(error, `global ${currentLocation()}`),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          .ge-wrap {
            min-height: 100dvh; display: flex; align-items: center;
            justify-content: center; padding: 3rem 1.25rem;
            font-family: system-ui, -apple-system, sans-serif;
            background: #f6f7f9; color: #1a1c1f;
          }
          .ge-card {
            width: 100%; max-width: 420px; text-align: center;
            background: #ffffff; border: 1px solid #e4e6ea;
            border-radius: 16px; padding: 1.75rem;
            box-shadow: 0 1px 2px rgba(0,0,0,.05);
          }
          .ge-title { font-size: 1.25rem; font-weight: 800; margin: 0; }
          .ge-body { margin: .5rem 0 0; font-size: .875rem; color: #5b6470; }
          .ge-detail {
            margin-top: 1rem; text-align: left; border-radius: 11px;
            border: 1px solid #e4e6ea; background: #f6f7f9; padding: .625rem .75rem;
          }
          .ge-label {
            margin: 0; font-size: .6875rem; font-weight: 600; letter-spacing: .12em;
            text-transform: uppercase; color: #99a1ad;
          }
          .ge-ref {
            margin: .25rem 0 0; font-size: .75rem; line-height: 1.6; color: #5b6470;
            font-family: ui-monospace, monospace; word-break: break-word;
          }
          .ge-row { margin-top: .5rem; display: flex; align-items: center; gap: .5rem; }
          .ge-copy {
            display: inline-flex; align-items: center; height: 2rem; padding: 0 .75rem;
            border-radius: 11px; border: none; background: transparent; color: #5b6470;
            font-weight: 600; font-size: .75rem; cursor: pointer;
          }
          .ge-copy:hover { background: #e9ebef; color: #1a1c1f; }
          .ge-which { font-family: ui-monospace, monospace; font-size: .625rem; color: #99a1ad; }
          .ge-btn {
            margin-top: 1.5rem; display: inline-flex; align-items: center;
            height: 2.5rem; padding: 0 1rem; border-radius: 11px; border: none;
            background: #4f46e5; color: #fff; font-weight: 600; font-size: .875rem;
            cursor: pointer;
          }
          @media (prefers-color-scheme: dark) {
            .ge-wrap { background: #0f1115; color: #e8eaed; }
            .ge-card { background: #171a1f; border-color: #2a2e35; }
            .ge-body { color: #9aa2ad; }
            .ge-detail { background: #0f1115; border-color: #2a2e35; }
            .ge-ref { color: #9aa2ad; }
            .ge-copy { color: #9aa2ad; }
            .ge-copy:hover { background: #2a2e35; color: #e8eaed; }
          }
        `}</style>
        <div className="ge-wrap">
          <div className="ge-card">
            <h1 className="ge-title">Something broke</h1>
            <p className="ge-body">
              An unexpected error stopped the app from loading. Trying again
              often clears it.
            </p>
            {summary && (
              <div className="ge-detail">
                <p className="ge-label">What broke</p>
                <p className="ge-ref">{summary}</p>
                <div className="ge-row">
                  <button className="ge-copy" onClick={copy}>
                    {copied ? "Copied" : "Copy details"}
                  </button>
                  <span className="ge-which">global</span>
                </div>
              </div>
            )}
            <button className="ge-btn" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
