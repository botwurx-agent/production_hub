"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { sendRemittance } from "@/app/(app)/projects/[id]/remittance-actions";
import { remittanceSubject } from "@/lib/remittance";
import type { ProjectCost } from "@/lib/database.types";

/**
 * "Their payment is on its way." Offered only on a cost that reads as PAID and
 * whose vendor is a roster contact with an email, so it never appears on a
 * till receipt from a shop there is nobody to write to.
 *
 * It stays pressable after a send, because "they never got it" is real and the
 * invite emails already work that way. What changes is that the row says when
 * it last went, so a second press is a deliberate repeat.
 */
export function RemittanceButton({
  projectId,
  cost,
  email,
  projectTitle,
  studioName,
}: {
  projectId: string;
  cost: ProjectCost;
  email: string;
  projectTitle: string | null;
  studioName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sent = cost.remittance_sent_at;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={
          sent
            ? `Remittance sent ${new Date(sent).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}. Send again?`
            : `Tell ${cost.vendor || "the vendor"} the payment is on its way`
        }
        aria-label="Send a remittance to the vendor"
        className={`grid h-7 w-7 place-items-center rounded-[7px] transition hover:bg-surface-2 ${
          sent ? "text-green" : "text-text-muted hover:text-accent"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="m3.5 7.5 8.5 6 8.5-6" />
        </svg>
      </button>

      {open && (
        <SendDocEmailModal
          open
          onClose={() => setOpen(false)}
          title={`Tell ${cost.vendor || "the vendor"} the payment is on its way`}
          defaultTo={email}
          defaultSubject={remittanceSubject({
            studio: studioName,
            amount: Number(cost.amount) || 0,
            description: cost.description,
            invoiceNumber: cost.invoice_number,
            project: projectTitle,
          })}
          onSend={async ({ to, subject, message }) => {
            const res = await sendRemittance(projectId, cost.id, {
              to,
              subject,
              message,
            });
            if ("ok" in res) router.refresh();
            return res;
          }}
        />
      )}
    </>
  );
}
