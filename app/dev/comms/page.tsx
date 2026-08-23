"use client";

import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { Sidebar } from "@/components/app-shell/sidebar";
import { EnvelopeIcon, HashIcon, PlusIcon } from "@/components/app-shell/nav-icons";

/**
 * A screenshot fixture for the Communication page, and the only page in this
 * repo that draws a screen instead of being one.
 *
 * WHY IT HAS TO EXIST. Every other marketing screenshot is taken by
 * scripts/capture-shots.mjs against the demo studio, because every other screen
 * renders from our own database. The Communication page does not: it holds the
 * LINK to a conversation and reads the messages from Gmail and Slack at render
 * time. There is nothing seedable about a Gmail thread, and there never will
 * be, since the whole point of the feature is that the mail still lives in the
 * mail. Without a live connector the panels can only ever be photographed shut.
 *
 * So this renders the real Sidebar, the real ProjectSubhead and the real Card
 * on the real design tokens, and fills the three panels with an invented
 * conversation written in the same Bright Water fiction the demo studio already
 * uses. The thread and channel markup is copied from what ThreadReader
 * (components/projects/project-email.tsx) and SlackReader
 * (components/communication/slack-panel.tsx) render when they are open. Restyle
 * either of those and this needs re-copying; a drift is visible the moment the
 * shot is retaken beside the others.
 *
 * It is a fixture, not a feature: nothing links here, it lives under /dev
 * alongside /dev/tokens, and it is signed out and database-free by design,
 * which is what makes it capturable in an environment that cannot reach
 * Supabase. If a throwaway inbox is ever connected to the demo studio, delete
 * this and add the real page to capture-shots.mjs, which is strictly better.
 *
 * Capture:  node scripts/capture-communication.mjs
 */

const PROJECT = "b1000000-0000-4000-a000-000000000001";

const EMAILS = [
  {
    from: "Dana Whitfield <dana@brightwater.example>",
    date: "August 21, 2026 at 9:41 AM",
    body: `Watched v2 with the brand team, we are close. The pour at 0:06 still reads slow against the music, can it come in six frames earlier?

Legal also came back on the on-screen line, it needs to say "naturally sourced" not "natural". Everything else is signed off our end.`,
    attachment: { name: "BrightWater_legal_wording_v3.pdf", meta: "PDF · 84 KB" },
  },
  {
    from: "Sean Ellis <sean@northlinestudio.example>",
    date: "August 21, 2026 at 10:12 AM",
    body: `Wording is quick, that one is done. I have pulled the pour forward eight frames and it sits better on the downbeat now.

New cut is on the review link, same URL as before so your notes carry across.`,
    attachment: null,
  },
];

const THREADS = [
  {
    sender: "Dana Whitfield",
    subject: "Hero cut v2, a couple of notes",
    snippet: "Watched v2 with the brand team. We are close. Two things and...",
    date: "Aug 21",
    unread: 2,
    open: true,
  },
  {
    sender: "Marcus Bell",
    subject: "Re: Shoot dates and the studio hold",
    snippet: "Confirming the 4th and 5th, stage 2 is held from 7am both days.",
    date: "Aug 17",
    unread: 0,
    open: false,
  },
];

const SLACK = [
  { author: "Priya Raman", time: "9:58 AM", text: "Legal wording came in on the client thread, grabbing it now. The pdf is on the email if you want the exact line." },
  { author: "Sean Ellis", time: "10:14 AM", text: "Got it. v3 rendering, should be on the review link in about ten minutes." },
];

function ThreadRow({ t }: { t: (typeof THREADS)[number] }) {
  return (
    <div
      className="overflow-hidden rounded-[12px] border border-border bg-surface"
      style={{ borderLeft: "3px solid var(--h-blue)" }}
    >
      <div className="flex items-start justify-between gap-2.5 px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ backgroundColor: "var(--h-blue-bg)", color: "var(--h-blue)" }}
          >
            <EnvelopeIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-sm text-text ${t.unread > 0 ? "font-bold" : "font-semibold"}`}>
                {t.sender}
              </span>
              <span className="shrink-0 text-xs text-text-faint">{t.date}</span>
            </span>
            <span className={`block truncate text-[13px] ${t.unread > 0 ? "font-semibold text-text" : "font-medium text-text-muted"}`}>
              {t.subject}
            </span>
            <span className="mt-0.5 block truncate text-xs text-text-faint">{t.snippet}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {t.unread > 0 && (
            <span className="inline-flex min-w-[20px] items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-accent-fg">
              {t.unread}
            </span>
          )}
          <span className="rounded-[8px] p-1 text-text-faint">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        </div>
      </div>

      {t.open && (
        <div className="border-t border-border px-3.5 py-3">
          <ol className="space-y-3">
            {EMAILS.map((m) => (
              <li key={m.from} className="rounded-[10px] bg-surface-2/50 p-3.5">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-text">{m.from}</span>
                  <span className="text-xs text-text-muted">{m.date}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">
                  {m.body}
                </p>
                {m.attachment && (
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface p-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
                          style={{ backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-text">
                            {m.attachment.name}
                          </span>
                          <span className="block text-[11px] text-text-faint">
                            {m.attachment.meta}
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[7px] border border-border bg-surface-2/60 px-2 py-1 text-[11px] font-semibold text-text-muted">
                          Add to documents
                        </span>
                        <span className="rounded-[7px] border border-border bg-surface-2/60 px-2 py-1 text-[11px] font-semibold text-text-muted">
                          Log as a cost
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-3 border-t border-border pt-3">
            <div className="min-h-[62px] w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text-faint">
              Reply to Dana Whitfield...
            </div>
            <div className="mt-2 flex items-center justify-end gap-3">
              <span className="mr-auto inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                </svg>
                Polish
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted">
                Attach
              </span>
              <span className="inline-flex items-center rounded-[9px] bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg">
                Send reply
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommsFixture() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar studioName="Northline Studio" assistant />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* A still of the topbar. The real one mounts a notification poll and a
            communication badge, both of which need a session this page does not
            have. */}
        <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <div className="flex-1" />
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface px-2.5 text-xs font-semibold text-text-muted">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
              Invite
            </span>
            <span className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-none text-accent-fg">
                3
              </span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-pill bg-accent-soft text-sm font-bold text-accent">
              S
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <ProjectSubhead
            projectId={PROJECT}
            projectTitle="Bright Water hero spot"
            section="Communication"
            hue="cyan"
            subtitle="Every conversation for this job, in one place."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />

          <div className="grid grid-cols-1 gap-6">
            <Card className="p-5">
              <h2 className="mb-4 font-display text-base font-bold">Email</h2>
              <div className="mb-3 flex justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted">
                  <PlusIcon /> Link email
                </span>
              </div>
              <div className="space-y-2">
                {THREADS.map((t) => (
                  <ThreadRow key={t.subject} t={t} />
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-display text-base font-bold">Slack</h2>
              <div className="mb-3 flex justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted">
                  <PlusIcon /> Link channel
                </span>
              </div>
              <div className="space-y-2">
                <div
                  className="overflow-hidden rounded-[12px] border border-border bg-surface"
                  style={{ borderLeft: "3px solid var(--h-purple)" }}
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                        style={{ backgroundColor: "var(--h-purple-bg)", color: "var(--h-purple)" }}
                      >
                        <HashIcon />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-text">
                          #brightwater-hero
                        </span>
                        <span className="block text-xs font-medium" style={{ color: "var(--h-purple)" }}>
                          Slack
                        </span>
                      </span>
                    </div>
                    <span className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-pill bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-accent-fg">
                      3
                    </span>
                    <span className="shrink-0 rounded-[8px] p-1 text-text-faint">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="border-t border-border px-3 py-3">
                    <ol className="space-y-3">
                      {SLACK.map((m) => (
                        <li key={m.time} className="rounded-[10px] bg-surface-2/50 p-3">
                          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-text">{m.author}</span>
                            <span className="text-xs text-text-faint">{m.time}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                            {m.text}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div
                  className="overflow-hidden rounded-[12px] border border-border bg-surface"
                  style={{ borderLeft: "3px solid var(--h-purple)" }}
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                        style={{ backgroundColor: "var(--h-purple-bg)", color: "var(--h-purple)" }}
                      >
                        <HashIcon />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text">
                          #northline-post
                        </span>
                        <span className="block text-xs font-medium" style={{ color: "var(--h-purple)" }}>
                          Slack
                        </span>
                      </span>
                    </div>
                    <span className="shrink-0 rounded-[8px] p-1 text-text-faint">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-display text-base font-bold">Google Chat</h2>
              <div className="mb-3 flex justify-end">
                <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text-muted">
                  <PlusIcon /> Link space
                </span>
              </div>
              <div
                className="overflow-hidden rounded-[12px] border border-border bg-surface"
                style={{ borderLeft: "3px solid var(--h-cyan)" }}
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                      style={{ backgroundColor: "var(--h-cyan-bg)", color: "var(--h-cyan)" }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">
                        Bright Water x Northline
                      </span>
                      <span className="block text-xs font-medium" style={{ color: "var(--h-cyan)" }}>
                        Google Chat
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 rounded-[8px] p-1 text-text-faint">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
