import { NextResponse } from "next/server";
import * as actions from "@/app/(app)/boards/actions";
import { BOARD_RPC } from "@/lib/board-rpc-names";
import { reportError } from "@/lib/log";

/**
 * The moodboard's own door to its server functions, used INSTEAD of calling
 * them as Server Actions. Same functions, same guards (requireStudioContext
 * and RLS inside each one); only the transport differs, and the transport is
 * the point.
 *
 * WHY: Next runs Server Actions through the app router. Every call parks a
 * pending promise in the router's state and they run strictly one at a time.
 * A canvas re-renders many times a second while a card is dragged or a box is
 * drawn, and React gives up on a tree that re-renders about a hundred times
 * while the router is still waiting on that promise: it throws error #482 and
 * the whole app falls to the global error screen. Reproduced by dragging cards
 * for two seconds while a save was slow. A plain fetch never touches the
 * router, so the canvas can save as often as it likes.
 *
 * The middleware already requires a session for this path. The origin check
 * is the cross-site guard Server Actions get built in.
 */
export const maxDuration = 60;

const ALLOWED = new Set<string>(BOARD_RPC);

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!host || originHost !== host) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
  }

  let body: { name?: unknown; args?: unknown; u?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  if (!ALLOWED.has(name) || !Array.isArray(body.args) || body.args.length > 8) {
    return NextResponse.json({ error: "Unknown call." }, { status: 404 });
  }
  // JSON has no `undefined`, and a null is not the same thing to a function
  // with a default parameter, so the client names the positions it left out.
  const args = [...body.args];
  if (Array.isArray(body.u)) {
    for (const i of body.u) {
      if (Number.isInteger(i) && i >= 0 && i < args.length) args[i] = undefined;
    }
  }

  const fn = (actions as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
  try {
    const result = await fn(...args);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    // redirect() and notFound() are thrown: let Next turn them into responses.
    if (e && typeof e === "object" && "digest" in e) throw e;
    reportError(`boards/rpc/${name}`, e);
    return NextResponse.json({ error: "That did not save." }, { status: 500 });
  }
}
