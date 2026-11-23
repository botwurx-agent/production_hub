// Which assistant is on the other end of an AI connector link. Pure, so it is
// testable: the name comes from the host's own `initialize` message, which is
// whatever that product chose to send.

/** The client name out of an MCP request body (a single call or a batch), or null. */
export function hostNameFrom(body: unknown): string | null {
  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls) {
    if (!c || typeof c !== "object") continue;
    const o = c as { method?: unknown; params?: { clientInfo?: { name?: unknown } } };
    if (o.method !== "initialize") continue;
    const n = o.params?.clientInfo?.name;
    if (typeof n !== "string") continue;
    const clean = n.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (clean) return clean;
  }
  return null;
}

/** The name a producer knows the assistant by. Unknown hosts read as "Assistant". */
export function hostLabel(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("claude") || n.includes("anthropic")) return "Claude";
  if (n.includes("chatgpt") || n.includes("openai")) return "ChatGPT";
  return "Assistant";
}

export type ConnectorChip =
  | { state: "none" }
  | { state: "unused" }
  | { state: "connected"; label: string; lastUsedAt: string; canEdit: boolean };

/**
 * What the dashboard says about this person's links: the one used most
 * recently wins; a link that exists but was never used is not "connected".
 */
export function connectorChip(
  links: { last_used_at: string | null; host_name: string | null; can_edit: boolean }[]
): ConnectorChip {
  if (!links.length) return { state: "none" };
  const used = links
    .filter((l) => l.last_used_at)
    .sort((a, b) => (a.last_used_at! < b.last_used_at! ? 1 : -1));
  if (!used.length) return { state: "unused" };
  const top = used[0];
  return { state: "connected", label: hostLabel(top.host_name), lastUsedAt: top.last_used_at!, canEdit: top.can_edit === true };
}
