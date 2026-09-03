"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  deleteMealRound,
  remindMealRound,
  saveMealRound,
  sendMealRound,
} from "@/app/(app)/projects/[id]/meal-actions";
import { MEALS, cutoffLabel, mealLabel, tallyMeal } from "@/lib/meals";
import type { CallSheetRecipient, MealResponse, MealRound } from "@/lib/database.types";

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

export type MealRoundWithResponses = MealRound & {
  responses: (MealResponse & { recipient_id: string })[];
};

/**
 * The producer's half of a meal round.
 *
 * Mirrors what actually happens on a shoot: the call sheet carries the lunch
 * notation, and a separate message goes out with the ordering link and a
 * cutoff. This owns everything either side of that link, and nothing about the
 * order itself, which lives on whatever platform the producer already uses.
 */
export function MealPanel({
  projectId,
  callSheetId,
  recipients,
  rounds,
  emailEnabled,
}: {
  projectId: string;
  callSheetId: string;
  recipients: CallSheetRecipient[];
  rounds: MealRoundWithResponses[];
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [meal, setMeal] = useState<string>("lunch");
  const round = useMemo(
    () => rounds.find((r) => r.meal === meal) ?? null,
    [rounds, meal],
  );

  const [orderUrl, setOrderUrl] = useState(round?.order_url ?? "");
  const [instructions, setInstructions] = useState(round?.instructions ?? "");
  const [cutoff, setCutoff] = useState(toLocalInput(round?.cutoff_at ?? null));
  const [sendAt, setSendAt] = useState(toLocalInput(round?.send_at ?? null));
  const [budget, setBudget] = useState(
    round?.budget_per_head ? String(round.budget_per_head) : "",
  );
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set(
        round
          ? round.responses.map((r) => r.recipient_id)
          : recipients.map((r) => r.id),
      ),
  );
  const [busy, start] = useTransition();

  // Switching meal switches which round is being edited, so the form has to
  // follow it rather than keep the previous meal's values.
  function switchMeal(next: string) {
    setMeal(next);
    const r = rounds.find((x) => x.meal === next) ?? null;
    setOrderUrl(r?.order_url ?? "");
    setInstructions(r?.instructions ?? "");
    setCutoff(toLocalInput(r?.cutoff_at ?? null));
    setSendAt(toLocalInput(r?.send_at ?? null));
    setBudget(r?.budget_per_head ? String(r.budget_per_head) : "");
    setPicked(
      new Set(
        r ? r.responses.map((x) => x.recipient_id) : recipients.map((x) => x.id),
      ),
    );
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save(then?: "send") {
    start(async () => {
      const res = await saveMealRound(projectId, callSheetId, {
        meal,
        orderUrl,
        instructions,
        cutoffAt: fromLocalInput(cutoff),
        sendAt: fromLocalInput(sendAt),
        budgetPerHead: budget ? Number(budget) : null,
        recipientIds: [...picked],
      });
      if ("error" in res) {
        toast(res.error);
        return;
      }
      if (then === "send") {
        const sent = await sendMealRound(projectId, res.id);
        if ("error" in sent) {
          toast(sent.error);
          return;
        }
        toast(
          sent.noEmail
            ? `Sent to ${sent.sent}. ${sent.noEmail} had no email address.`
            : `${mealLabel(meal)} order sent to ${sent.sent}.`,
        );
      } else {
        toast("Saved.");
      }
      router.refresh();
    });
  }

  function chase() {
    if (!round) return;
    start(async () => {
      const res = await remindMealRound(projectId, round.id);
      if ("error" in res) toast(res.error);
      else
        toast(
          res.sent
            ? `Nudged ${res.sent}.`
            : "Everyone has opened the link already.",
        );
      router.refresh();
    });
  }

  function remove() {
    if (!round) return;
    if (!confirm(`Delete the ${mealLabel(meal).toLowerCase()} order?`)) return;
    start(async () => {
      const res = await deleteMealRound(projectId, round.id);
      if (res?.error) toast(res.error);
      else {
        toast("Deleted.");
        switchMeal(meal);
        router.refresh();
      }
    });
  }

  const tally = round ? tallyMeal(round.responses) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {MEALS.map((m) => {
          const on = m.key === meal;
          const exists = rounds.some((r) => r.meal === m.key);
          return (
            <button
              key={m.key}
              onClick={() => switchMeal(m.key)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold transition ${
                on
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              {m.label}
              {exists ? " ·" : ""}
            </button>
          );
        })}
      </div>

      {round?.sent_at && tally ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-border bg-surface-2 px-4 py-3 text-sm">
          <span className="font-semibold text-text">
            {tally.ordered} ordered
          </span>
          <span className="text-text-muted">{tally.opened} opened</span>
          <span
            className="font-semibold"
            style={{ color: tally.outstanding ? "var(--amber)" : "var(--green)" }}
          >
            {tally.outstanding} outstanding
          </span>
          {round.cutoff_at ? (
            <span className="text-text-faint">
              closes {cutoffLabel(round.cutoff_at)}
            </span>
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-text">
          Ordering link
        </span>
        <input
          value={orderUrl}
          onChange={(e) => setOrderUrl(e.target.value)}
          placeholder="Paste the DoorDash, Uber Eats or ezCater group link"
          className={inputCls}
        />
        <span className="mt-1 block text-xs text-text-faint">
          Crew order on that platform. Studio Flows sends the link, tracks who
          has opened it, and chases the rest.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text">
            Orders close
          </span>
          <input
            type="datetime-local"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text">
            Send at (optional)
          </span>
          <input
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text">
            Budget per person
          </span>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            inputMode="decimal"
            placeholder="25.00"
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-text">
          Instructions
        </span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Order by 10am. Put your name in the order notes so we can hand it out on set."
          className={inputCls}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-text">
            Who is eating ({picked.size} of {recipients.length})
          </span>
          <button
            onClick={() =>
              setPicked(
                picked.size === recipients.length
                  ? new Set()
                  : new Set(recipients.map((r) => r.id)),
              )
            }
            className="text-xs font-semibold text-accent hover:underline"
          >
            {picked.size === recipients.length ? "Clear all" : "Select all"}
          </button>
        </div>
        {recipients.length === 0 ? (
          <p className="rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
            Add people to this call sheet first, then pick who is on the order.
          </p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-[10px] border border-border p-2">
            {recipients.map((r) => {
              const state = round?.responses.find(
                (x) => x.recipient_id === r.id,
              );
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-sm hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="flex-1 text-text">{r.name}</span>
                  {!r.email ? (
                    <span className="text-xs text-text-faint">no email</span>
                  ) : state?.ordered_at ? (
                    <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>
                      ordered
                    </span>
                  ) : state?.opened_at ? (
                    <span className="text-xs text-text-muted">opened</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {!emailEnabled ? (
        <p
          className="rounded-[10px] px-3 py-2 text-xs"
          style={{ backgroundColor: "var(--amber-bg)", color: "var(--amber)" }}
        >
          Email is not set up here, so the order cannot be sent automatically.
          Save it and share the link yourself.
        </p>
      ) : null}

      <p className="rounded-[10px] border border-border bg-surface-2/40 px-3 py-2 text-xs text-text-muted">
        This is its own email, separate from the call sheet. You do not need to
        resend the call sheet: everyone opens theirs on a live link, so the
        meal shows up on it as soon as you save.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => save()} disabled={busy} variant="secondary">
          Save
        </Button>
        <Button
          onClick={() => save("send")}
          disabled={busy || !emailEnabled || picked.size === 0}
        >
          {round?.sent_at
            ? `Resend the order link to ${picked.size}`
            : `Email the order link to ${picked.size}`}
        </Button>
        {round?.sent_at ? (
          <Button onClick={chase} disabled={busy} variant="secondary">
            Chase outstanding
          </Button>
        ) : null}
        {round ? (
          <button
            onClick={remove}
            disabled={busy}
            className="text-sm font-semibold text-text-muted hover:text-red"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A datetime-local input speaks in the browser's own timezone with no offset,
 * while the column is timestamptz. These two convert both ways so a 10am cutoff
 * typed on set is 10am where the shoot is, not 10am UTC.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
