"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { actionError } from "@/lib/action-result";
import { shortDate, timeAgo } from "@/lib/format";
import {
  createConnectorLink,
  revokeConnectorLink,
  setConnectorLinkEdit,
} from "@/app/(app)/settings/connector-actions";

export type ConnectorLinkRow = {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  canEdit: boolean;
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
  const [newCanEdit, setNewCanEdit] = useState(false);
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
      const res = await createConnectorLink(name, newCanEdit);
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

  async function setEdit(l: ConnectorLinkRow, next: boolean) {
    if (next === l.canEdit) return;
    // The confirm is asked OUTSIDE the transition: its window is opened by a
    // state update, and one made inside a pending transition waits for that
    // transition, which is itself waiting for the answer.
    if (next) {
      const ok = await confirmAction({
        title: `Let "${l.name}" change existing work?`,
        body: "The assistant on this link will be able to change shots, storyboard frames, tasks and draft call sheets, as well as add. A change is made as soon as it is asked for, and the assistant then tells you what each thing said before. It still cannot delete or send anything, or change a call sheet that has been sent.",
        confirmLabel: "Allow editing",
      });
      if (!ok) return;
    }
    start(async () => {
      const res = await setConnectorLinkEdit(l.id, next);
      const e = actionError(res);
      if (e) {
        toast(e, "error");
        return;
      }
      toast(
        next ? "This link can now add and edit. Start a new chat for it to take effect." : "This link can only add now.",
        "success"
      );
      router.refresh();
    });
  }

  return (
    <div id="ai-connector" className="scroll-mt-24 space-y-5" data-ai-connector>
      <p className="max-w-2xl text-sm text-text-muted">
        Connect your own Claude and brief it like a production assistant. It answers from
        your studio (what is still owed, where a job stands, which client is slow to sign
        off) and does the typing for you: shot lists, storyboards, moodboards, the schedule,
        draft call sheets, contacts, tasks, costs, props, clients, deals and new projects.
        It works as you and never deletes or sends anything. Each link either only{" "}
        <span className="font-semibold text-text">adds</span>, or can also{" "}
        <span className="font-semibold text-text">edit</span> shots, storyboard frames, tasks
        and draft call sheets: you choose per link, below. Your own AI subscription does
        the work, so there is nothing extra to pay here.
      </p>

      <div className="max-w-2xl rounded-[12px] border border-border p-3">
        <p className="text-xs font-semibold text-text-muted">Once connected, try</p>
        <ul className="mt-1.5 space-y-1 text-sm text-text">
          <li>&ldquo;Here is the script. Break it into a shot list for the job.&rdquo;</li>
          <li>&ldquo;Build the schedule from that shot list, then Thursday&rsquo;s call sheet.&rdquo;</li>
          <li>&ldquo;Where does this job stand, and who do we still owe?&rdquo;</li>
        </ul>
      </div>

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
        <label className="min-w-[160px]">
          <span className="mb-1 block text-xs font-semibold text-text-muted">It can</span>
          <select
            value={newCanEdit ? "edit" : "add"}
            onChange={(e) => setNewCanEdit(e.target.value === "edit")}
            className="h-[38px] w-full rounded-[10px] border border-border bg-surface px-3 text-sm text-text"
            data-connector-new-mode
          >
            <option value="add">Add only</option>
            <option value="edit">Add and edit</option>
          </select>
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
            Copy this now. It is shown once, and anyone holding it can work in the studio as you.
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
              <div className="flex items-center gap-2">
                <select
                  aria-label={`What ${l.name} can do`}
                  value={l.canEdit ? "edit" : "add"}
                  onChange={(e) => setEdit(l, e.target.value === "edit")}
                  disabled={pending}
                  className="h-8 rounded-[8px] border border-border bg-surface px-2 text-xs font-semibold text-text"
                  data-connector-mode
                >
                  <option value="add">Add only</option>
                  <option value="edit">Add and edit</option>
                </select>
                <Button size="sm" variant="danger" onClick={() => turnOff(l)} disabled={pending}>
                  Turn off
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
