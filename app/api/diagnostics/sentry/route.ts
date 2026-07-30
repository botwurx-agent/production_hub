// Proves that error reporting actually reaches Sentry.
//
// Setting a DSN is silent: nothing in the app changes, and the only way to know
// it worked is for an error to occur, which is a bad moment to discover that it
// did not. This makes one on purpose.
//
// Signed-in studio members only. Not because a deliberate test error is
// sensitive, but because an open endpoint that generates events is an open
// endpoint for filling someone's error quota.
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getStudioContext } from "@/lib/studio";
import { allow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

class SentryVerificationError extends Error {
  constructor(when: string) {
    super(`Studio Flows Sentry verification, triggered ${when}`);
    this.name = "SentryVerificationError";
  }
}

export async function GET(req: Request) {
  const ctx = await getStudioContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (ctx.isCollaborator) {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }
  if (!allow(`sentry-diag:${ctx.userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Slow down, that is enough test errors." },
      { status: 429 }
    );
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        // The value itself is never returned, only whether one exists.
        error:
          "NEXT_PUBLIC_SENTRY_DSN is not set in this runtime, so nothing is being reported. Set it in Vercel and redeploy.",
      },
      { status: 503 }
    );
  }

  const when = new Date().toISOString();

  // ?throw=1 exercises the path a REAL crash takes (thrown, caught by the
  // framework's instrumentation) rather than the explicit-capture path that
  // lib/log.ts reportError uses. Both are worth being able to test: most of the
  // app reports through reportError, but an unhandled throw in a route or a
  // server component goes through instrumentation's onRequestError instead.
  const url = new URL(req.url);
  if (url.searchParams.get("throw") === "1") {
    throw new SentryVerificationError(when);
  }

  const eventId = Sentry.captureException(new SentryVerificationError(when), {
    tags: { context: "sentry-verification" },
    extra: { studio: ctx.studio.name, triggeredBy: ctx.email },
  });

  // Serverless can freeze the instance the moment the response is sent, before
  // the event has left. Waiting for the flush is the difference between "we
  // queued it" and "Sentry has it".
  const delivered = await Sentry.flush(4000);

  return NextResponse.json({
    ok: delivered,
    configured: true,
    eventId,
    delivered,
    when,
    note: delivered
      ? "Search Sentry for this eventId. If it is there, server error reporting works."
      : "The event was captured but did not flush in time. It may still arrive; check Sentry.",
  });
}
