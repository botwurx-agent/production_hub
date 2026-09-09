"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorDetail } from "@/components/ui/error-detail";

// Catches errors within app pages while keeping the shell (sidebar/topbar)
// around it, so the user can navigate elsewhere instead of hitting a dead end.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-[420px] p-7 text-center">
        <h1 className="font-display text-lg font-bold">This page hit a snag</h1>
        <p className="mt-2 text-sm text-text-muted">
          Something went wrong loading this view. Try again, or head back to
          your projects.
        </p>
        <ErrorDetail error={error} boundary="app" />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/projects">
            <Button variant="secondary">Back to projects</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
