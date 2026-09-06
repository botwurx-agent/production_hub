"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addCallSheetRecipient,
  addCallSheetRecipients,
  deleteCallSheetRecipient,
  sendCallSheetEmail,
  sendCallSheetToAll,
  remindUnconfirmed,
} from "@/app/(app)/projects/[id]/callsheet-actions";
import { toast } from "@/components/ui/toast";
import { recipientStage, tallyRecipients, type StepState } from "@/lib/callsheet-status";
import type { CallSheetRecipient } from "@/lib/database.types";

export type ContactOption = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
};

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

function fmt(ts: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

type Filter = "all" | "open" | "confirmed" | "unsent";

/** One number, said plainly. Colour is the signal, not decoration. */
function Tally({
  label,
  count,
  total,
  hue,
}: {
  label: string;
  count: number;
  total?: number;
  hue: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-[9px] px-2.5 py-1"
      style={{ backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
    >
      <span className="text-sm font-extrabold">
        {count}
        {total != null ? `/${total}` : ""}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
    </span>
  );
}

export function RecipientsPanel({
  projectId,
  callSheetId,
  recipients,
  contactOptions = [],
  emailEnabled = false,
  meals,
  onOpenMeals,
}: {
  projectId: string;
  callSheetId: string;
  recipients: CallSheetRecipient[];
  contactOptions?: ContactOption[];
  emailEnabled?: boolean;
  /**
   * The meal rounds on this sheet, so the panel can carry the step that comes
   * AFTER sending. Absent when there is nowhere to open the meal panel.
   */
  meals?: { meal: string; sent_at: string | null; ordered: number; total: number }[];
  onOpenMeals?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [chasing, setChasing] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();

  // The three states a producer actually cares about on the morning of a
  // shoot, in the order they care about them.
  const t = tallyRecipients(recipients);
  const confirmed = recipients.filter((r) => recipientStage(r).key === "confirmed");
  const unsent = recipients.filter((r) => recipientStage(r).key === "unsent");
  const outstanding = t.outstanding;

  const shown =
    filter === "confirmed"
      ? confirmed
      : filter === "open"
        ? recipients.filter((r) => recipientStage(r).key !== "confirmed")
        : filter === "unsent"
          ? unsent
          : recipients;

  // What select-all means: the people ON SCREEN who can actually be emailed.
  // Scoped to the filter, so ticking the box after choosing "Not sent" selects
  // exactly the ones that chip promised, and never somebody hidden behind it.
  const sendable = shown.filter((r) => r.email?.trim());

  function chase() {
    setChasing(true);
    remindUnconfirmed(projectId, callSheetId).then((res) => {
      setChasing(false);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      const parts = [`Reminded ${res.sent}`];
      if (res.noEmail > 0)
        parts.push(`${res.noEmail} with no email address, send their link`);
      toast(parts.join(". "), res.sent > 0 ? "success" : "error");
      router.refresh();
    });
  }

  function sendAll(resend: boolean, recipientIds?: string[]) {
    setSendingAll(true);
    sendCallSheetToAll(projectId, callSheetId, { resend, recipientIds }).then((res) => {
      setSendingAll(false);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      // Says what actually happened to all twelve, rather than a bare
      // "sent": a skipped person and a failed person are different problems.
      const parts: string[] = [`Sent to ${res.sent}`];
      if (res.skipped > 0) parts.push(`${res.skipped} already had it`);
      if (res.noEmail > 0) parts.push(`${res.noEmail} with no email, copy their link`);
      if (res.failed > 0) parts.push(`${res.failed} failed`);
      toast(parts.join(". "), res.failed > 0 ? "error" : "success");
      setChosen(new Set());
      router.refresh();
    });
  }

  function emailLink(recipientId: string) {
    setSending(recipientId);
    sendCallSheetEmail(projectId, recipientId).then((res) => {
      setSending(null);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      // No transient "Sent" flash any more: the row itself now carries
      // sent_at, so the refresh below is what turns the row green, and it
      // STAYS green. The old flash reverted after 2.5 seconds and left a
      // producer twelve rows in unable to tell who had been emailed.
      toast("Call sheet emailed.", "success");
      router.refresh();
    });
  }

  // Contacts not already added (match by email, else name).
  const addedKeys = new Set(
    recipients.map((r) => (r.email?.trim().toLowerCase() || r.name.trim().toLowerCase()))
  );
  const seen = new Set<string>();
  const available = contactOptions.filter((c) => {
    const key = c.email?.trim().toLowerCase() || c.name.trim().toLowerCase();
    if (!key || addedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPicked() {
    const people = available
      .filter((c) => picked.has(c.id))
      .map((c) => ({ name: c.name, email: c.email }));
    if (people.length === 0) return;
    setError(null);
    start(async () => {
      const res = await addCallSheetRecipients(projectId, callSheetId, people);
      if ("error" in res) setError(res.error);
      else {
        setPicked(new Set());
        router.refresh();
      }
    });
  }

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin =
    siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const linkFor = (token: string) => `${origin}/c/${token}`;

  function add() {
    if (!name.trim()) return setError("Add a name.");
    setError(null);
    start(async () => {
      const res = await addCallSheetRecipient(projectId, callSheetId, name, email);
      if ("error" in res) setError(res.error);
      else {
        setName("");
        setEmail("");
        router.refresh();
      }
    });
  }

  function copy(token: string) {
    const url = linkFor(token);
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(token);
        setTimeout(() => setCopied(null), 1800);
      },
      () => {}
    );
  }

  function remove(id: string) {
    start(async () => {
      await deleteCallSheetRecipient(projectId, id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {emailEnabled
          ? "Add each person, then email them their private link (or copy it to send by text or Slack). You'll see when they view it and when they confirm. No login needed."
          : "Add each person, then copy their private link to send (email, text, Slack). You'll see when they view it and when they confirm. No login needed."}
      </p>

      {/* Pick from project contacts */}
      <div className="rounded-[12px] border border-border bg-surface-2/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Add from project contacts
          </span>
          {available.length > 0 && (
            <button
              onClick={addPicked}
              disabled={busy || picked.size === 0}
              className="rounded-[9px] bg-accent px-3 py-1 text-xs font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-40"
            >
              Add selected{picked.size > 0 ? ` (${picked.size})` : ""}
            </button>
          )}
        </div>
        {available.length === 0 ? (
          <p className="py-2 text-xs text-text-muted">
            {contactOptions.length === 0 ? (
              <>
                No one on this project&apos;s roster yet.{" "}
                <Link
                  href={`/projects/${projectId}/contacts`}
                  className="font-semibold text-accent hover:underline"
                >
                  Add crew &amp; talent on the Contacts page
                </Link>
                , then pick them here.
              </>
            ) : (
              "Everyone on the roster has already been added below."
            )}
          </p>
        ) : (
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {available.map((c) => {
              const on = picked.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 transition hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => togglePick(c.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-text">{c.name}</span>
                    {(c.role || c.email) && (
                      <span className="ml-1.5 truncate text-xs text-text-faint">
                        {[c.role, c.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Add manually */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={inputCls}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className={inputCls}
        />
        <Button onClick={add} disabled={busy}>
          {busy ? "Adding..." : "Add"}
        </Button>
      </div>
      {error && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{error}</p>
      )}

      {/* Where twenty people stop being a list and start being an answer. The
          three numbers are the question a producer is really asking, and the
          chips filter straight to the ones still outstanding. */}
      {recipients.length > 0 && (
        <div className="rounded-[12px] border border-border bg-surface-2/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tally label="Confirmed" count={t.confirmed} total={t.total} hue="green" />
            {t.opened > 0 && <Tally label="Opened, not confirmed" count={t.opened} hue="blue" />}
            {t.sent > 0 && <Tally label="Sent, not opened" count={t.sent} hue="amber" />}
            {t.unsent > 0 && <Tally label="Not sent" count={t.unsent} hue="red" />}
            <span className="ml-auto flex items-center gap-1.5">
              {emailEnabled && unsent.length > 0 && (
                <button
                  onClick={() => sendAll(false)}
                  disabled={sendingAll}
                  className="rounded-[9px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {sendingAll
                    ? "Sending…"
                    : `Send to ${unsent.length} ${unsent.length === 1 ? "person" : "people"}`}
                </button>
              )}
              {/* Only once everybody has had it, and never the primary
                  action: putting a second copy of a call sheet into twelve
                  inboxes is something you should have to mean. */}
              {emailEnabled && unsent.length === 0 && recipients.some((r) => r.sent_at) && (
                <button
                  onClick={() => sendAll(true)}
                  disabled={sendingAll}
                  className="rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50"
                >
                  {sendingAll ? "Sending…" : "Resend to everyone"}
                </button>
              )}
              {emailEnabled && outstanding > 0 && (
                <button
                  onClick={chase}
                  disabled={chasing}
                  className="rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50"
                >
                  {chasing ? "Sending…" : `Remind ${outstanding} unconfirmed`}
                </button>
              )}
            </span>
          </div>
          {t.noEmail > 0 && (
            <p className="mt-2 text-[11.5px] text-amber">
              {t.noEmail} {t.noEmail === 1 ? "person has" : "people have"} no email
              address, so they can only be sent their link by hand.
            </p>
          )}
          {outstanding > 0 && (
            <p className="mt-2 text-[11.5px] text-text-muted">
              Anyone still unconfirmed is reminded automatically once a day in
              the three days before the shoot, twice at most. Confirming stops
              it.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1">
            {(
              [
                ["all", `Everyone (${t.total})`],
                ["unsent", `Not sent (${t.unsent})`],
                ["open", `Outstanding (${outstanding})`],
                ["confirmed", `Confirmed (${t.confirmed})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition ${
                  filter === key
                    ? "bg-accent text-accent-fg"
                    : "border border-border text-text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* THE SELECTION BAR. Appears only when people are chosen, and states the
          count in the button itself, so the thing being confirmed is "these
          eight get emailed" rather than a bare "Send". */}
      {chosen.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-accent bg-accent-soft/50 px-3 py-2.5">
          <span className="text-sm font-bold text-accent">
            {chosen.size} selected
          </span>
          <button
            onClick={() => setChosen(new Set())}
            className="text-xs font-semibold text-text-muted transition hover:text-text"
          >
            Clear
          </button>
          <span className="flex-1" />
          {emailEnabled && (
            <button
              onClick={() => sendAll(true, [...chosen])}
              disabled={sendingAll}
              className="rounded-[10px] bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
            >
              {sendingAll
                ? "Sending…"
                : `Send the call sheet to ${chosen.size}`}
            </button>
          )}
        </div>
      )}

      {/* Once the sheet has gone out, the meal order is the next thing that
          happens, and it used to live behind an unrelated button in the
          toolbar with nothing connecting the two. */}
      {onOpenMeals && recipients.some((r) => r.sent_at) && (
        <button
          onClick={onOpenMeals}
          className="flex w-full items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 text-left transition hover:bg-surface-2"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]" style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2M6 2v10m0 0v10M18 2c-1.7 1.5-2.5 3.8-2.5 6.5S16.3 13 18 14v8" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text">
              {!meals || meals.length === 0
                ? "Set up the crew meal"
                : meals.every((m) => m.sent_at)
                  ? `Meal order sent${meals.length === 1 ? "" : ` (${meals.length} rounds)`}`
                  : "Meal order not sent yet"}
            </span>
            <span className="block text-xs text-text-muted">
              {!meals || meals.length === 0
                ? "A separate email with the group order link. The call sheet does not need resending."
                : meals
                    .map((m) =>
                      m.sent_at
                        ? `${m.meal}: ${m.ordered}/${m.total} ordered`
                        : `${m.meal}: not sent`
                    )
                    .join(" · ")}
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-accent">Open</span>
        </button>
      )}

      {/* List */}
      {recipients.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No recipients yet. Add crew and talent to send them the call sheet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border">
          {/* ONE STATUS COLUMN, not three date columns. Three of them meant a
              person who did everything on one day read as "Sep 2 Sep 2 Sep 2",
              and twelve of those is thirty-six dates and no answer.

              The actions track is a FIXED width, which is also the bug that
              made the old header sit right of its values: the header and the
              body are separate grids, and with an `auto` last track the empty
              header cell measured 0 while the body's buttons measured ~260px,
              so the flexible columns resolved differently in each. */}
          <div className="grid grid-cols-[22px_1fr_170px_224px] items-center gap-3 border-b border-border bg-surface-2/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            {/* Select-all covers the rows CURRENTLY SHOWN, not the whole
                sheet: with a filter applied, "all" meaning something other
                than what is on screen is how people send to the wrong list. */}
            <input
              type="checkbox"
              aria-label="Select everyone shown"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={sendable.length > 0 && sendable.every((r) => chosen.has(r.id))}
              ref={(el) => {
                if (el) {
                  const some = sendable.some((r) => chosen.has(r.id));
                  el.indeterminate = some && !sendable.every((r) => chosen.has(r.id));
                }
              }}
              onChange={(e) =>
                setChosen(
                  e.target.checked ? new Set(sendable.map((r) => r.id)) : new Set()
                )
              }
            />
            <span>Recipient</span>
            <span>Status</span>
            <span />
          </div>
          {shown.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-faint">
              {filter === "open"
                ? "Everyone has confirmed."
                : filter === "unsent"
                  ? "Everyone with an email address has been sent it."
                  : "Nobody has confirmed yet."}
            </p>
          )}
          {shown.map((r) => {
            const st = recipientStage(r);
            return (
            <div
              key={r.id}
              className={`grid grid-cols-[22px_1fr_170px_224px] items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 ${
                chosen.has(r.id) ? "bg-accent-soft/40" : ""
              }`}
            >
              {/* Nobody without an address can be emailed, so offering to
                  select them would build a list that silently cannot be sent. */}
              <input
                type="checkbox"
                aria-label={`Select ${r.name}`}
                disabled={!r.email}
                className="h-4 w-4 accent-[var(--accent)] disabled:opacity-30"
                checked={chosen.has(r.id)}
                onChange={(e) =>
                  setChosen((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  })
                }
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{r.name}</div>
                {r.email ? (
                  <div className="truncate text-xs text-text-faint">{r.email}</div>
                ) : (
                  <div className="truncate text-xs text-amber">No email address</div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Steps steps={st.steps} hue={st.hue} />
                  <span
                    className="truncate text-[12.5px] font-bold"
                    style={{ color: hueVar(st.hue) }}
                  >
                    {st.label}
                  </span>
                  {st.at && (
                    <span className="shrink-0 text-[12px] text-text-muted">
                      {fmt(st.at)}
                    </span>
                  )}
                </div>
                {/* Only where something needs saying, so it is read when it
                    appears rather than tuned out. */}
                {st.note && (
                  <div className="truncate text-[11px] text-text-faint">{st.note}</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1">
                {emailEnabled && r.email && (
                  <button
                    onClick={() => emailLink(r.id)}
                    disabled={sending === r.id}
                    className="min-w-[66px] rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    {sending === r.id ? "Sending…" : r.sent_at ? "Resend" : "Email"}
                  </button>
                )}
                <button
                  onClick={() => copy(r.token)}
                  className="min-w-[76px] rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  {copied === r.token ? "Copied" : "Copy link"}
                </button>
                <button
                  onClick={() => remove(r.id)}
                  disabled={busy}
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Remove recipient"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Token for a stage hue, so the row and the tallies cannot disagree. */
function hueVar(hue: string): string {
  return hue === "muted" ? "var(--text-muted)" : `var(--h-${hue})`;
}

/**
 * Emailed, opened, confirmed, as three dots.
 *
 * The progression is the thing a producer is scanning for, and three dots read
 * faster than three dates: a row of filled dots is done, a gap is where
 * somebody stopped. The dates are still on the row, they just stop competing.
 */
function Steps({
  steps,
  hue,
}: {
  steps: [StepState, StepState, StepState];
  hue: string;
}) {
  const labels = ["Emailed", "Opened", "Confirmed"];
  const words: Record<StepState, string> = {
    done: "yes",
    none: "no",
    unknown: "sent before this was tracked, so the time is unknown",
  };
  return (
    <span className="flex shrink-0 items-center gap-[3px]" aria-hidden>
      {steps.map((st, i) => (
        <span
          key={i}
          title={`${labels[i]}: ${words[st]}`}
          className="h-[6px] w-[6px] rounded-full"
          style={{
            // A HOLLOW RING for unknown, so it reads as "we cannot say" rather
            // than as a definite no. A flat grey dot would claim the send did
            // not happen, which is exactly the wrong thing to assert.
            backgroundColor: st === "done" ? hueVar(hue) : "transparent",
            border: st === "done" ? undefined : `1.5px solid var(--border-strong)`,
            opacity: st === "none" ? 0.45 : 1,
          }}
        />
      ))}
    </span>
  );
}
