"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { actionError } from "@/lib/action-result";
import { shortDate, timeAgo } from "@/lib/format";
import { createConnectorLink, revokeConnectorLink } from "@/app/(app)/settings/connector-actions";

export type ConnectorLinkRow = {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/**
 * Connect Claude or ChatGPT to the studio. A link, not a sign-in, because a
 * private URL is the one thing both hosts accept without an OAuth server, and
 * because it turns off with one press. The link is shown ONCE: only its hash
 * is kept, so the copy step happens here or not at all.
 */
export function AiConnector({ links, canUse }: { links: ConnectorLinkRow[]; canUse: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canUse) {
    return (
      <p className="text-sm text-text-muted">
        Connecting an AI assistant is for studio members.
      </p>
    );
  }

  function make() {
    start(async () => {
      const res = await createConnectorLink(name);
      const e = actionError(res);
      if (e || !res || !res.ok) {
        toast(e ?? "The link could not be made.", "error");
        return;
      }
      setFresh(res.url);
      setName("");
      try {
        await navigator.clipboard.writeText(res.url);
        toast("Link made and copied.", "success");
      } catch {
        toast("Link made. Copy it below.", "success");
      }
      router.refresh();
    });
  }

  async function turnOff(link: ConnectorLinkRow) {
    const ok = await confirmAction({
      title: `Turn off "${link.name}"?`,
      body: "Any assistant using this link stops being able to read the studio straight away. This cannot be undone; you can always make a new link.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    start(async () => {
      const res = await revokeConnectorLink(link.id);
      const e = actionError(res);
      if (e) {
        toast(e, "error");
        return;
      }
      toast("Link turned off.", "success");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5" data-ai-connector>
      <p className="max-w-2xl text-sm text-text-muted">
        Ask Claude or ChatGPT about your jobs in plain words: what is still owed, where a
        project stands, which client is slow to sign off. It reads what you can read in
        Studio Flows and <span className="font-semibold text-text">cannot change anything</span>.
        Your own AI subscription does the work.
      </p>

      <ol className="grid gap-3 text-sm sm:grid-cols-2">
        <li className="rounded-[12px] border border-border bg-surface-2 p-3">
          <span className="font-semibold text-text">Claude</span>
          <span className="mt-1 block text-text-muted">
            Settings, Connectors, Add custom connector, then paste the link. Needs a paid
            Claude plan.
          </span>
        </li>
        <li className="rounded-[12px] border border-border bg-surface-2 p-3">
          <span className="font-semibold text-text">ChatGPT</span>
          <span className="mt-1 block text-text-muted">
            Settings, Apps and Connectors, turn on developer mode, create a connector with
            the link and no authentication.
          </span>
        </li>
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1 sm:max-w-xs">
          <span className="mb-1 block text-xs font-semibold text-text-muted">Name this link</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude on my laptop"
            maxLength={60}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                make();
              }
            }}
          />
        </label>
        <Button onClick={make} disabled={pending} data-connector-make>
          {pending ? "Making..." : "Make a link"}
        </Button>
      </div>

      {fresh && (
        <div className="rounded-[12px] border border-border bg-surface-2 p-3" data-connector-fresh>
          <p className="text-sm text-text">
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ background: "var(--h-amber)" }}
            />
            Copy this now. It is shown once, and anyone holding it can read the studio as you.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text">
              {fresh}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fresh);
                  toast("Copied.", "success");
                } catch {
                  toast("Select the link and copy it by hand.", "error");
                }
              }}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="divide-y divide-border rounded-[12px] border border-border">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{l.name}</p>
                <p className="text-xs text-text-muted">
                  ends {l.last4} · made {shortDate(l.createdAt)} ·{" "}
                  {l.lastUsedAt ? `last used ${timeAgo(l.lastUsedAt)}` : "not used yet"}
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={() => turnOff(l)} disabled={pending}>
                Turn off
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
