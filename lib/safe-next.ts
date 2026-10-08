// Where to send somebody after they sign in, read from a `next` value that
// arrived in a URL and so cannot be trusted. Only a same-site path survives:
// "//evil.com" and "/\evil.com" both resolve to ANOTHER origin through the URL
// constructor (browsers treat a backslash as a slash), which would turn the
// sign-in page into an open redirect. Pure, so it is testable.
export function safeNext(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return fallback;
  // Control characters (a smuggled newline or tab) have no business in a path.
  if (/[\u0000-\u001f\u007f]/.test(v)) return fallback;
  // Sending somebody back to the sign-in page after signing in is a loop.
  if (/^\/(login|signup)(\/|\?|$)/.test(v)) return fallback;
  return v.slice(0, 2000);
}
