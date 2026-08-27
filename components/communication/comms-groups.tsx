"use client";

import Link from "next/link";
import { StatusTag, type Hue } from "@/components/status-tag";
import {
  CommsChips,
  useCommsFilter,
} from "@/components/communication/comms-filter";
import {
  ThreadReader,
  type LinkedThread,
} from "@/components/projects/project-email";
import {
  SlackReader,
  type LinkedSlackChannel,
} from "@/components/communication/slack-panel";
import {
  ChatReader,
  type LinkedChatSpace,
} from "@/components/communication/gchat-panel";

/**
 * The studio-wide Communication list: every linked conversation grouped by the
 * job (or lead, or client) it belongs to, with the same platform filter chips
 * the project page carries. The two pages share the chips, the state and the
 * localStorage key, so "show me Slack" follows the person from one to the
 * other.
 *
 * A client component because the filter is interactive; everything it receives
 * is plain data. Filtered-out readers are HIDDEN rather than unmounted, so an
 * open thread survives a glance at another platform, and a group whose every
 * conversation is filtered out hides whole rather than leaving a headline over
 * nothing.
 */

export type StudioCommsGroup = {
  key: string;
  label: string;
  href: string;
  kind: "Project" | "Lead" | "Client";
  hue: Hue;
  projectId?: string;
  email: LinkedThread[];
  slack: (LinkedSlackChannel & { unread: number })[];
  chat: (LinkedChatSpace & { unread: number })[];
};

export function StudioComms({
  groups,
  canSend,
  slackCanSend,
  chatCanSend,
}: {
  groups: StudioCommsGroup[];
  canSend: boolean;
  slackCanSend: boolean;
  chatCanSend: boolean;
}) {
  const { filter, pick } = useCommsFilter();
  const show = (svc: "gmail" | "slack" | "gchat") =>
    filter === "all" || filter === svc;

  const totals = groups.reduce(
    (acc, g) => {
      acc.email += g.email.length;
      acc.slack += g.slack.length;
      acc.chat += g.chat.length;
      return acc;
    },
    { email: 0, slack: 0, chat: 0 }
  );

  return (
    <div>
      <CommsChips
        filter={filter}
        onPick={pick}
        emailCount={totals.email}
        slackCount={totals.slack}
        chatCount={totals.chat}
      />

      <div className="space-y-8">
        {groups.map((g) => {
          const visible =
            (show("gmail") && g.email.length > 0) ||
            (show("slack") && g.slack.length > 0) ||
            (show("gchat") && g.chat.length > 0);
          const count =
            (show("gmail") ? g.email.length : 0) +
            (show("slack") ? g.slack.length : 0) +
            (show("gchat") ? g.chat.length : 0);
          return (
            <section key={g.key} className={visible ? "" : "hidden"}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="h-6 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--h-${g.hue})` }}
                />
                <Link
                  href={g.href}
                  className="font-display text-lg font-extrabold tracking-tight text-text transition hover:text-accent"
                >
                  {g.label}
                </Link>
                <StatusTag hue={g.hue} dot={false}>
                  {g.kind}
                </StatusTag>
                <span className="text-xs font-medium text-text-faint">
                  {count} {count === 1 ? "conversation" : "conversations"}
                </span>
              </div>
              <div className="space-y-2">
                <div className={show("gmail") ? "space-y-2" : "hidden"}>
                  {g.email.map((t) => (
                    <ThreadReader
                      key={t.id}
                      thread={t}
                      canSend={canSend}
                      projectId={g.projectId}
                      revalidate="/communication"
                    />
                  ))}
                </div>
                <div className={show("slack") ? "space-y-2" : "hidden"}>
                  {g.slack.map((c) => (
                    <SlackReader
                      key={c.id}
                      channel={c}
                      projectId={g.projectId}
                      canSend={slackCanSend}
                      revalidate="/communication"
                      unread={c.unread}
                    />
                  ))}
                </div>
                <div className={show("gchat") ? "space-y-2" : "hidden"}>
                  {g.chat.map((s) => (
                    <ChatReader
                      key={s.id}
                      space={s}
                      canSend={chatCanSend}
                      revalidate="/communication"
                      unread={s.unread}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
