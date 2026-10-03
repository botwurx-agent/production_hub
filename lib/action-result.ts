// Reading the result of a Server Action without trusting that there is one.
//
// A Server Action does not always resolve to what it returns. When the session
// has expired the request is answered with a redirect to /login, and the
// promise resolves to UNDEFINED; the same happens when a page loaded from an
// older deployment calls an action that deployment no longer has. Code written
// as `if ("error" in res)` then throws a TypeError and the whole surface
// crashes to an error boundary, which on a payment window is the worst place
// for it: somebody is left not knowing whether money moved.
//
// So every caller goes through here, and an absent result is reported as what
// it actually is rather than as a crash.
export function actionError(res: unknown): string | null {
  if (res === undefined || res === null) {
    return "That did not reach the server. Your session may have expired, so reload the page and check before trying again.";
  }
  if (typeof res !== "object") {
    return "The server sent back something unreadable. Reload the page and check before trying again.";
  }
  const e = (res as { error?: unknown }).error;
  if (typeof e === "string" && e) return e;
  return null;
}
