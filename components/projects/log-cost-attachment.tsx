"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CostModal, type RosterOption } from "@/components/production/cost-ledger";
import {
  draftCostFromAttachment,
  attachEmailInvoice,
  type CostInput,
} from "@/app/(app)/projects/[id]/cost-actions";
import type { BudgetLine } from "@/lib/database.types";

/**
 * Logs an emailed invoice as a project cost without it ever touching a desktop.
 * A freelancer sends a PDF, this reads it, and the producer confirms the same
 * form they would have filled by hand.
 *
 * Only offered for a document that could plausibly be an invoice, and only when
 * the thread is tied to a project, since a cost has to land somewhere.
 */
export function LogCostAttachment({
  projectId,
  messageId,
  attachmentId,
  filename,
  mimeType,
}: {
  projectId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
}) {
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [initial, setInitial] = useState<CostInput | null>(null);
  const [filled, setFilled] = useState<string[] | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [roster, setRoster] = useState<RosterOption[]>([]);

  function begin() {
    start(async () => {
      const res = await draftCostFromAttachment(
        projectId,
        messageId,
        attachmentId,
        filename,
        mimeType
      );
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      setLines(res.lines as unknown as BudgetLine[]);
      setRoster(res.roster);

      const got: string[] = [];
      const d = res.draft;
      const draft: CostInput = {
        vendor: d?.vendor ?? "",
        description: d?.description ?? "",
        amount: d?.amount ?? 0,
        days: d?.days ?? null,
        budgetLineId: d?.budgetLineId ?? null,
        contactId: res.contactId,
        invoiceNumber: d?.invoiceNumber ?? null,
        invoiceDate: d?.invoiceDate ?? null,
        dueDate: d?.dueDate ?? null,
        status: "received",
        notes: d?.notes ?? null,
      };
      if (d?.vendor) got.push("vendor");
      if (d?.description) got.push("description");
      if (d?.amount !== null && d?.amount !== undefined) got.push("amount");
      if (d?.days !== null && d?.days !== undefined) got.push("days billed");
      if (d?.invoiceNumber) got.push("invoice number");
      if (d?.invoiceDate) got.push("invoice date");
      if (d?.dueDate) got.push("due date");
      if (d?.budgetLineId) got.push("budget line");
      if (res.contactId) got.push(`roster match (${res.vendorMatch})`);

      setInitial(draft);
      setFilled(got);
      setOpen(true);
      if (d?.currency && d.currency.toUpperCase() !== "USD") {
        toast(
          `That invoice is in ${d.currency.toUpperCase()}. Amounts here are USD.`,
          "error"
        );
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={begin}
        disabled={busy || done}
      >
        {busy ? "Reading..." : done ? "Logged" : "Log as a cost"}
      </Button>

      {open && (
        <CostModal
          projectId={projectId}
          cost={null}
          lines={lines}
          roster={roster}
          initial={initial}
          initialFilled={filled}
          attachment={{
            label: filename,
            // Fetched from Gmail again on save, so abandoning the form leaves
            // no stored copy behind.
            attach: (costId) =>
              attachEmailInvoice(
                projectId,
                costId,
                messageId,
                attachmentId,
                filename,
                mimeType
              ),
          }}
          onClose={() => {
            setOpen(false);
            setDone(true);
          }}
        />
      )}
    </>
  );
}
