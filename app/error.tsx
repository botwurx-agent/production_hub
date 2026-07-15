"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Catches errors thrown above the app shell (e.g. in the (app) layout when a
// studio context fails to load). Renders inside the root layout, so tokens and
// styles are available.
export default function RootError({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-12">
      <Card className="w-full max-w-[420px] p-7 text-center">
        <h1 className="font-display text-xl font-extrabold">Something broke</h1>
        <p className="mt-2 text-sm text-text-muted">
          An unexpected error stopped this page from loading. Trying again often
          clears it.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-text-faint">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/dashboard">
            <Button variant="secondary">Go to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
