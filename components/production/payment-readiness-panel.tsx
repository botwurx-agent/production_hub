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
  type PaymentReadiness,
} from "@/app/(app)/projects/[id]/payment-readiness-actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusTag, type Hue } from "@/components/status-tag";
import { actionError } from "@/lib/action-result";
import { categoryLabel } from "@/lib/crew-positions";
import type { Readiness } from "@/lib/payment-details";

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
    return "BILL holds no bank details for them, so a payment today would post a paper check. Open them in BILL and send the ACH sign-up invite.";
  if (r.state === "absent")
    return "BILL has never heard of them. They are added the first time you pay them, and the ACH invite goes after that.";
  if (r.state === "card")
    return "BILL is set to pay them by virtual card rather than ACH. Change it in BILL if that is not what you want.";
  return "BILL did not say how they get paid. Check their payment method in BILL before paying.";
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
        <ReadinessBody data={data} />
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
export function ReadinessBody({ data }: { data: PaymentReadiness }) {
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
