import "server-only";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/rate-limit";

// Runner is the only feature in the app with a real per-use cost, and it is now
// the first row in the left nav. Every other expensive path is a deliberate
// button press on a document; this one is a chat box, and a chat box invites
// holding down Enter.
//
// Two limits, deliberately different in kind:
//
//   BURST is the in-memory limiter, per user. It stops a stuck client or an
//   impatient hand, and it is honest about being best-effort: serverless
//   instances are ephemeral, so it throttles a warm instance rather than
//   guaranteeing a global ceiling.
//
//   The DAILY cap is the one that actually bounds the bill, so it cannot be
//   best-effort. It counts real rows: every turn already writes a user message
//   to agent_messages with a studio_id and a timestamp, so the count IS the
//   usage and it is shared across every instance without new infrastructure.

/** Turns one person may take in a short window. */
const BURST_MAX = 12;
const BURST_WINDOW_MS = 5 * 60_000;

/**
 * Turns a whole studio may take in 24 hours. Generous for real use (a producer
 * asking a dozen questions a day is nowhere near it) and low enough that a
 * runaway loop or a bored beta user cannot run up a serious bill overnight.
 * Override per deployment while the real usage shape is still unknown.
 */
const DAILY_MAX = Number(process.env.RUNNER_DAILY_LIMIT) || 200;

export type LimitVerdict = { ok: true } | { ok: false; message: string };

export async function checkRunnerLimits(opts: {
  userId: string;
  studioId: string;
}): Promise<LimitVerdict> {
  if (!allow(`runner:${opts.userId}`, BURST_MAX, BURST_WINDOW_MS)) {
    return {
      ok: false,
      message: "That is a lot of questions at once. Give it a minute.",
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const supabase = createClient();
  const { count, error } = await supabase
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", opts.studioId)
    .eq("role", "user")
    .gte("created_at", since);

  // If the count cannot be read, allow the turn. A limiter that fails closed
  // would take Runner down for everyone the moment a query hiccups, which is a
  // worse outcome than one uncounted question.
  if (error) return { ok: true };

  if ((count ?? 0) >= DAILY_MAX) {
    return {
      ok: false,
      message:
        "Runner has hit its daily limit for this studio. It resets on a rolling 24 hours.",
    };
  }

  return { ok: true };
}
