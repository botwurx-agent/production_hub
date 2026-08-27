"use client";

// Dev-only fixture: the redesigned Communication readers with seeded data, so
// the Gmail/Slack idioms can be seen without a reachable database. Not linked
// from anywhere; /dev/* is auth-gated in production.
import { ThreadReader } from "@/components/projects/project-email";
import { SlackReader } from "@/components/communication/slack-panel";
import { ServiceHeader } from "@/components/communication/comms-ui";
import { Card } from "@/components/ui/card";

const now = Date.now();
const emails = [
  {
    id: "m1",
    from: "Dana Whitfield <dana@brightwater.example>",
    date: "", dateMs: now - 3 * 864e5,
    bodyText: "Hi team, sending over the revised brief for the summer spot. The tasting notes section changed the most, please give it a read before Thursday.",
    attachments: [],
  },
  {
    id: "m2",
    from: "Priya Raman <priya@northline.example>",
    date: "", dateMs: now - 2 * 864e5,
    bodyText: "Got it, thanks Dana. We will fold this into the shot list and flag anything that moves the schedule.",
    attachments: [],
  },
  {
    id: "m3",
    from: "Dana Whitfield <dana@brightwater.example>",
    date: "", dateMs: now - 6 * 36e5,
    bodyText: "One more thing: legal signed off on the on-pack claim, so the end card copy is final. Can you confirm the VO session is still Tuesday?\n\nOn Tue, Aug 25, Priya wrote:\n> We will fold this into the shot list",
    attachments: [],
  },
] as never[];

const slackMsgs = [
  { ts: String((now - 5 * 36e5) / 1000), author: "Marcus Okafor", text: "Gaffer kit confirmed for Friday. Pier 4 has power on the north wall, so no genny needed.", files: [] },
  { ts: String((now - 3 * 36e5) / 1000), author: "Priya Raman", text: "Great. Call sheet goes out tonight, watch for your personal link.", files: [] },
  { ts: String((now - 1 * 36e5) / 1000), author: "Sofia Lindqvist", text: "Lens list updated in the project, 24 and 50 primes plus the probe for the pour.", files: [] },
] as never[];

export default function Dev() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Card className="p-5">
        <ServiceHeader service="gmail" title="Email" connected detail="1 conversation linked" />
        <ThreadReader
          thread={{
            id: "t1", gmail_thread_id: "g1",
            subject: "Bright Water summer spot, revised brief",
            last_message_at: new Date(now - 6 * 36e5).toISOString(),
            preview: { from: "Dana Whitfield <dana@brightwater.example>", snippet: "Legal signed off on the on-pack claim, so the end card copy is final.", dateMs: now - 6 * 36e5, unread: 2 } as never,
          }}
          canSend
          revalidate="/dev/comms2"
          initialMessages={emails}
        />
      </Card>
      <Card className="p-5">
        <ServiceHeader service="slack" title="Slack" connected detail="1 channel linked" />
        <SlackReader
          channel={{ id: "c1", slack_channel_id: "C123", channel_name: "brightwater-crew" }}
          canSend
          revalidate="/dev/comms2"
          unread={1}
          initialMessages={slackMsgs}
        />
      </Card>
    </div>
  );
}
