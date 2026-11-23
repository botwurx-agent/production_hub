import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { ConnectorChip as Chip } from "@/lib/connector-host";

/**
 * The assistant's light on the dashboard: whether this person's Claude or
 * ChatGPT link is set up and has been used. It reports the LAST USE, not a
 * live presence: an assistant only contacts Studio Flows when it is asked
 * something, so "listening right now" is not a thing we can know or claim.
 */
export function ConnectorChip({ chip }: { chip: Chip }) {
  const base =
    "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition hover:bg-surface-2";
  if (chip.state === "none") {
    return (
      <Link href="/settings#ai-connector" data-connector-chip="none" className={`${base} border-dashed border-border-strong text-text-muted hover:text-text`}>
        <span className="h-2 w-2 rounded-full border border-border-strong" aria-hidden />
        Connect Claude
      </Link>
    );
  }
  if (chip.state === "unused") {
    return (
      <Link href="/settings#ai-connector" data-connector-chip="unused" className={`${base} border-border text-text`} title="A link exists, but no assistant has used it yet. Paste it into Claude or ChatGPT to finish.">
        <span className="h-2 w-2 rounded-full bg-amber" aria-hidden />
        Assistant link not used yet
      </Link>
    );
  }
  return (
    <Link
      href="/settings#ai-connector"
      data-connector-chip="connected"
      className={`${base} border-border bg-surface text-text`}
      title={`${chip.label} can ${chip.canEdit ? "add and edit" : "add only"}. Manage the link in Settings.`}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-40 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
      </span>
      {chip.label} connected
      <span className="font-normal text-text-muted">
        · used {timeAgo(chip.lastUsedAt)} · {chip.canEdit ? "add and edit" : "add only"}
      </span>
    </Link>
  );
}
