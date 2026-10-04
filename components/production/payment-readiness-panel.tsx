"use client";

// HOW BILL WILL PAY EACH PERSON ON THIS JOB, asked at wrap.
//
// A vendor BILL has no bank details for is paid by POSTED PAPER CHECK, and
// this studio pays freelancers by ACH. The send window refuses a check at the
// moment of paying, which is correct and far too late: net 30, invoice in
// hand. This answers the same question a month earlier, while there is still
// time to do something about it.
//
// IT OPENS ON A PRESS, never on page load: reading it costs a BILL sign-in
// plus a vendor read, and most people opening the roster came to look up a
// phone number.
import { useEffect, useState } from "react";
import {
  loadPaymentReadiness,
  requestPaymentDetails,
  type InviteResult,
  type PaymentReadiness,
} from "@/app/(app)/projects/[id]/payment-readiness-actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusTag, type Hue } from "@/components/status-tag";
import { actionError } from "@/lib/action-result";
import { confirmAction, type ConfirmRequest } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { categoryLabel } from "@/lib/crew-positions";
import type { Readiness } from "@/lib/payment-details";
import type { BillAddress } from "@/lib/bill";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

/** Color as signal: these are states, so they wear the status-chip idiom. */
const STATE: Record<Readiness["state"], { hue: Hue; chip: string }> = {
  ach: { hue: "green", chip: "ACH" },
  check: { hue: "red", chip: "Check" },
  card: { hue: "blue", chip: "Card" },
  unknown: { hue: "amber", chip: "Unclear" },
  absent: { hue: "amber", chip: "Not at BILL" },
};

/**
 * WHAT TO DO ABOUT IT, in the words of the job. Deliberately no deep link
 * into BILL: the per-vendor web URL is not documented anywhere reachable from
 * here, and the FreshBooks round cost a day to a guessed one.
 */
function nextStep(r: Readiness): string {
  if (r.state === "ach") return "";
  if (r.state === "check")
    return "BILL holds no bank details for them, so a payment today would post a paper check. Ask them to add their own, and they can be paid by ACH.";
  if (r.state === "absent")
    return "BILL has never met them. Adding their address here lets BILL email them to collect their bank details, so they can be paid by ACH.";
  if (r.state === "card")
    return "BILL is set to pay them by virtual card rather than ACH. Change it in BILL if that is not what you want.";
  return "BILL did not say how they get paid. Check their payment method in BILL before paying.";
}

/**
 * WHO AN INVITE CAN GO TO. Two states, for two different reasons, and both are
 * the normal case at WRAP.
 *
 * ABSENT: BILL has never met them, which is true of every freelancer on a
 * first job. The invite is addressed to a vendor id, so one is created first,
 * and BILL requires an address to do that. Those rows ask for it.
 *
 * CHECK: BILL knows them and would post a paper cheque, so they are exactly
 * who this exists for, and no address is needed since the vendor is there.
 *
 * Deliberately NOT card or unknown: both HAVE a method, so asking them for
 * bank details is the wrong move. Never without an email, which is what BILL
 * writes to.
 */
function invitable(r: Readiness): boolean {
  return (r.state === "check" || r.state === "absent") && !r.needsEmail;
}

/** The ones an invite can reach with nothing further from the producer. */
function readyToAsk(r: Readiness): boolean {
  return invitable(r) && r.state === "check";
}

/**
 * WHAT THE CONFIRM SAYS, as a pure function so the wording can be exercised
 * rather than read. It is a claim about what is about to happen to named
 * people, which is the same reason lib/remittance.ts is a module instead of a
 * string in an action.
 *
 * IT NAMES THE PEOPLE AND THEIR ADDRESSES, capped at four plus a count, since
 * what is being confirmed is "these humans are about to be emailed about their
 * bank details" and a confirmation you cannot check in two seconds is not one.
 */
export function inviteConfirm(rows: Readiness[]): ConfirmRequest {
  const named = rows.slice(0, 4).map((r) => `${r.name} (${r.email})`);
  const rest = rows.length - named.length;
  const who = named.join(", ") + (rest > 0 ? ` and ${rest} more` : "");
  return {
    title:
      rows.length === 1
        ? `Ask ${rows[0].name} for their payment details?`
        : `Ask ${rows.length} people for their payment details?`,
    body:
      `BILL emails ${who} and asks them to add their own bank details, so they` +
      " can be paid by ACH instead of a posted check. Their details go to BILL" +
      " and never to this app.",
    confirmLabel: rows.length === 1 ? "Send the request" : `Send ${rows.length} requests`,
    destructive: false,
  };
}

export function PaymentReadinessButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} title="How BILL will pay each person on this job">
        Payment setup
      </Button>
      {open && <PaymentReadinessPanel projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

function PaymentReadinessPanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PaymentReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<Readiness | null>(null);

  function load() {
    return loadPaymentReadiness(projectId).then((res) => {
      const err = actionError(res);
      if (err) setError(err);
      else setData(res as PaymentReadiness);
    });
  }

  useEffect(() => {
    let alive = true;
    void loadPaymentReadiness(projectId).then((res) => {
      if (!alive) return;
      const err = actionError(res);
      if (err) setError(err);
      else setData(res as PaymentReadiness);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function request(rows: Readiness[], addresses?: Record<string, BillAddress>) {
    if (rows.length === 0 || busy) return;
    const ok = await confirmAction(inviteConfirm(rows));
    if (!ok) return;

    setBusy(true);
    const res = await requestPaymentDetails(
      projectId,
      rows.map((r) => r.contactId),
      addresses
    );
    const err = actionError(res);
    if (err) {
      toast(err, "error");
    } else {
      const { sent, skipped } = res as InviteResult;
      if (sent > 0) toast(sent === 1 ? "Request sent." : `${sent} requests sent.`, "success");
      // Each skip names the person and the reason, so one missing email does
      // not read as the whole press having failed.
      for (const line of skipped.slice(0, 4)) toast(line, "error");
      await load();
    }
    setBusy(false);
  }

  return (
    <Modal open onClose={onClose} title="Payment setup" size="lg">
      {error ? (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm text-text">{error}</p>
      ) : !data ? (
        <p className="text-sm text-text-muted">Asking BILL how each person gets paid...</p>
      ) : !data.connected ? (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm text-text">
          BILL is not connected. A studio admin can connect it in Settings, and
          this page can then say how each person on the job gets paid.
        </p>
      ) : (
        <ReadinessBody
          data={data}
          onRequest={request}
          onAddress={setAsking}
          busy={busy}
        />
      )}

      {asking && (
        <AddressAsk
          row={asking}
          busy={busy}
          onClose={() => setAsking(null)}
          onSend={(address) => {
            const row = asking;
            setAsking(null);
            void request([row], { [row.contactId]: address });
          }}
        />
      )}

      <div className="flex justify-end pt-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/**
 * The loaded view, PRESENTATIONAL and hook-free, so a /dev fixture can mount
 * the real thing on hardcoded rows. A session here cannot reach Supabase or
 * BILL, so without this split the only states ever seen would be "loading"
 * and "failed", which is how a layout ships unchecked.
 */
export function ReadinessBody({
  data,
  onRequest,
  onAddress,
  busy,
}: {
  data: PaymentReadiness;
  /** Omitted in a read-only context; without it no invite is offered. */
  onRequest?: (rows: Readiness[]) => void;
  /** Asked for the people BILL has never met, who need one to be created. */
  onAddress?: (row: Readiness) => void;
  busy?: boolean;
}) {
  // The bulk press only takes the ones needing nothing further. Somebody
  // BILL has never met needs an address, which is a form per person, so
  // those keep their own button rather than stacking twelve forms.
  const askable = data.rows.filter(readyToAsk);
  const waiting = data.tally.check + data.tally.absent;
  if (data.rows.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Nobody on this roster gets paid yet. Crew, talent, extras and vendors
        show here once they are added; clients do not, since they are the ones
        paying.
      </p>
    );
  }
  return (
        <div className="space-y-4">
          <div className="rounded-[12px] border border-border bg-surface-2 p-3">
            {/* THE CHECK CLAIM COVERS ONLY THE ROWS IT IS TRUE OF. A first
                draft read "a payment to any of the others would post a paper
                check", which is false for a virtual-card vendor and unknown
                for one whose method BILL did not name. This window exists to
                state how money will travel, so it cannot overstate it by one
                row. */}
            <p className="text-sm leading-relaxed text-text">
              <strong className="font-semibold">
                {data.tally.ach} of {data.tally.total}
              </strong>{" "}
              can be paid by ACH today.
              {waiting > 0 && (
                <>
                  {" "}
                  {waiting === 1 ? "One would" : `${waiting} would`} be posted a
                  paper check instead.
                </>
              )}
              {data.tally.other > 0 && (
                <>
                  {" "}
                  {data.tally.other === 1 ? "One is" : `${data.tally.other} are`}{" "}
                  set to something else, named in the rows below.
                </>
              )}
            </p>
            {onRequest && askable.length > 1 && (
              <div className="mt-3">
                <Button size="sm" disabled={busy} onClick={() => onRequest(askable)}>
                  {busy ? "Sending..." : `Ask all ${askable.length} for their details`}
                </Button>
              </div>
            )}
            <p className="mt-1 text-xs leading-relaxed text-text-faint">
              Read from BILL just now, across {data.vendorsRead}{" "}
              {data.vendorsRead === 1 ? "vendor" : "vendors"} it holds. Nothing
              here was changed and nobody was emailed.
            </p>
          </div>

          <ul className="divide-y divide-border rounded-[12px] border border-border">
            {data.rows.map((r) => {
              const s = STATE[r.state];
              const step = nextStep(r);
              return (
                <li key={r.contactId} className="px-3 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-text">{r.name}</span>
                    <span className="text-xs text-text-faint">
                      {r.role ? `${r.role} · ` : ""}
                      {categoryLabel(r.category)}
                    </span>
                    <span className="ml-auto">
                      <StatusTag hue={s.hue}>{s.chip}</StatusTag>
                    </span>
                  </div>
                  {step && (
                    <p className="mt-1 text-sm leading-relaxed text-text">{step}</p>
                  )}
                  {onRequest && invitable(r) && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => (r.state === "absent" ? onAddress?.(r) : onRequest([r]))}
                        title={`BILL emails ${r.email} and asks for their bank details`}
                      >
                        Request payment details
                      </Button>
                    </div>
                  )}
                  {r.needsEmail && (
                    <p className="mt-1 text-sm leading-relaxed text-text">
                      No email on the roster, and an ACH invite needs one. Add
                      it to their contact first.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
  );
}

/**
 * THE ONE THING BILL NEEDS BEFORE IT CAN WRITE TO A STRANGER. A vendor cannot
 * be created without a postal address, and the invite is addressed to a vendor,
 * so this is asked ONCE PER PERSON EVER: the vendor persists across every job
 * after this one, so the second booking asks for nothing.
 *
 * IT SAYS WHERE TO FIND IT, because at wrap a producer often does not have a
 * crew member's address in front of them and an unexplained form is where a
 * flow stops. An invoice prints it, and an invoice is what arrives next.
 *
 * NOTHING IS STORED HERE. It goes to BILL with the vendor and is forgotten,
 * which is a stronger version of the 0074 rule: a freelancer's address is
 * usually their home address, and the safest place for it is not our database.
 */
function AddressAsk({
  row,
  busy,
  onClose,
  onSend,
}: {
  row: Readiness;
  busy: boolean;
  onClose: () => void;
  onSend: (address: BillAddress) => void;
}) {
  const [a, setA] = useState({ line1: "", city: "", state: "", zip: "" });
  const done = Boolean(a.line1.trim() && a.city.trim() && a.state.trim() && a.zip.trim());

  return (
    <Modal open onClose={onClose} title={`Add ${row.name} to BILL`} size="md">
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-text">
          BILL has not met {row.name} yet, and it needs a postal address to add
          them before it can email {row.email} about their bank details. It is
          usually printed on their invoice. This is asked once, not per job.
        </p>
        <input
          className={field}
          placeholder="Street address"
          value={a.line1}
          onChange={(e) => setA({ ...a, line1: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            className={field}
            placeholder="City"
            value={a.city}
            onChange={(e) => setA({ ...a, city: e.target.value })}
          />
          <input
            className={field}
            placeholder="State"
            value={a.state}
            onChange={(e) => setA({ ...a, state: e.target.value })}
          />
          <input
            className={field}
            placeholder="ZIP"
            value={a.zip}
            onChange={(e) => setA({ ...a, zip: e.target.value })}
          />
        </div>
        <p className="text-xs leading-relaxed text-text-faint">
          Their address goes to BILL with the vendor record. Studio Flows does
          not keep it, and never asks anybody for bank details.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !done}
            onClick={() =>
              onSend({
                line1: a.line1.trim(),
                city: a.city.trim(),
                stateOrProvince: a.state.trim(),
                zipOrPostalCode: a.zip.trim(),
                country: "US",
              })
            }
          >
            Add and send the request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
