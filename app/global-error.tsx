"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors in the root layout itself. It replaces
// the entire document, so it must render its own <html>/<body> and cannot rely
// on the app's global stylesheet. Styles are inlined and theme-aware.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light dark; }
          .ge-wrap {
            min-height: 100vh; display: flex; align-items: center;
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
          .ge-ref { margin-top: .75rem; font-size: .75rem; color: #99a1ad; font-family: ui-monospace, monospace; }
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
          }
        `}</style>
        <div className="ge-wrap">
          <div className="ge-card">
            <h1 className="ge-title">Something broke</h1>
            <p className="ge-body">
              An unexpected error stopped the app from loading. Trying again
              often clears it.
            </p>
            {error.digest && <p className="ge-ref">Reference: {error.digest}</p>}
            <button className="ge-btn" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
