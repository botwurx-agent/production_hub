"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusTag, type Hue } from "@/components/status-tag";
import {
  createProjectDocument,
  sendProjectDocument,
  syncProjectDocument,
} from "@/app/(app)/projects/[id]/billing-actions";
import type { ProjectInvoice } from "@/lib/database.types";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};
type PricedDeliverable = { name: string; rate: number | null; qty: number | null };

const ISTATUS: Record<string, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "yellow" },
  sent: { label: "Sent", hue: "blue" },
  viewed: { label: "Viewed", hue: "cyan" },
  partial: { label: "Partly paid", hue: "purple" },
  paid: { label: "Paid", hue: "green" },
  overdue: { label: "Overdue", hue: "red" },
  disputed: { label: "Disputed", hue: "red" },
  accepted: { label: "Accepted", hue: "green" },
  declined: { label: "Declined", hue: "red" },
};

function money(n: number | null | undefined, currency = "USD") {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

type LineRow = { name: string; qty: string; rate: string };

function CreateModal({
  projectId,
  kind,
  contacts,
  deliverables,
  onClose,
}: {
  projectId: string;
  kind: "invoice" | "estimate";
  contacts: Contact[];
  deliverables: PricedDeliverable[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Recipient: an existing contact id, or "new" for manual entry.
  const [recipientId, setRecipientId] = useState<string>(
    contacts[0]?.id ?? "new",
  );
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");

  const [lines, setLines] = useState<LineRow[]>([{ name: "", qty: "1", rate: "" }]);

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { name: "", qty: "1", rate: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function pullDeliverables() {
    const priced = deliverables
      .filter((d) => d.rate != null && Number(d.rate) > 0)
      .map((d) => ({
        name: d.name || "Deliverable",
        qty: String(d.qty ?? 1),
        rate: String(d.rate),
      }));
    if (priced.length) setLines(priced);
  }

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.rate) || 0) * (Number(l.qty) || 0),
    0,
  );

  function submit() {
    setError(null);
    const recipient =
      recipientId === "new"
        ? { name: newName, email: newEmail, company: newCompany }
        : { contactId: recipientId };
    start(async () => {
      const res = await createProjectDocument(projectId, {
        kind,
        recipient,
        lines: lines.map((l) => ({
          name: l.name,
          qty: Number(l.qty) || 1,
          rate: Number(l.rate) || 0,
        })),
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={kind === "estimate" ? "New estimate" : "New invoice"}
    >
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Bill to
          </label>
          <select
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className={`mt-1 ${field}`}
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
                {c.email ? ` (${c.email})` : " (no email)"}
              </option>
            ))}
            <option value="new">+ New recipient…</option>
          </select>
          {recipientId === "new" && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className={field}
              />
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className={field}
              />
              <input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Company (optional)"
                className={field}
              />
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Line items
            </label>
            {deliverables.some((d) => d.rate != null && d.rate > 0) && (
              <button
                type="button"
                onClick={pullDeliverables}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Pull from deliverables
              </button>
            )}
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={l.name}
                  onChange={(e) => setLine(i, { name: e.target.value })}
                  placeholder="Description"
                  className={`${field} flex-1`}
                />
                <input
                  type="number"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  placeholder="Qty"
                  className={`${field} w-16 text-center`}
                  title="Quantity"
                />
                <div className="flex w-28 items-center rounded-[10px] border border-border bg-surface px-2 focus-within:border-border-strong">
                  <span className="text-sm text-text-faint">$</span>
                  <input
                    type="number"
                    value={l.rate}
                    onChange={(e) => setLine(i, { rate: e.target.value })}
                    placeholder="Rate"
                    className="w-full bg-transparent px-1 py-2 text-sm text-text outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Remove line"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-2 text-xs font-semibold text-accent hover:underline"
          >
            + Add line
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold text-text">
            Total {money(total)}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Creating..." : `Create ${kind}`}
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function InvoicingPanel({
  projectId,
  invoices,
  freshbooksConnected,
  contacts,
  deliverables,
}: {
  projectId: string;
  invoices: ProjectInvoice[];
  freshbooksConnected: boolean;
  contacts: Contact[];
  deliverables: PricedDeliverable[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "invoice" | "estimate">(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | null | undefined>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">Invoices & estimates</h3>
          <p className="text-xs text-text-faint">
            Created and billed through FreshBooks; tracked here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setModal("estimate")}
            disabled={!freshbooksConnected}
          >
            New estimate
          </Button>
          <Button
            size="sm"
            onClick={() => setModal("invoice")}
            disabled={!freshbooksConnected}
          >
            New invoice
          </Button>
        </div>
      </div>

      {!freshbooksConnected && (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-yellow">
          Connect FreshBooks in{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          to create invoices and estimates.
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {error}
        </p>
      )}

      {freshbooksConnected && invoices.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No invoices or estimates yet. Create one to bill this project.
        </p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const s = ISTATUS[inv.status] ?? { label: inv.status, hue: "blue" as Hue };
            const isDraft = inv.status === "draft";
            const isEstimate = inv.kind === "estimate";
            return (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <span
                      className="rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: isEstimate
                          ? "var(--h-purple-bg)"
                          : "var(--h-blue-bg)",
                        color: isEstimate ? "var(--h-purple)" : "var(--h-blue)",
                      }}
                    >
                      {isEstimate ? "Estimate" : "Invoice"}
                    </span>
                    {inv.number ? `#${inv.number}` : "Draft"}
                    <span className="font-normal text-text-muted">
                      {money(inv.amount, inv.currency)}
                    </span>
                    {inv.amount_paid > 0 && (
                      <span className="text-xs font-semibold text-green">
                        {money(inv.amount_paid, inv.currency)} paid
                      </span>
                    )}
                  </div>
                  {inv.recipient_name && (
                    <div className="text-xs text-text-faint">
                      To {inv.recipient_name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag hue={s.hue}>{s.label}</StatusTag>
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run(() => sendProjectDocument(projectId, inv.id))}
                    >
                      Send
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => run(() => syncProjectDocument(projectId, inv.id))}
                  >
                    Refresh
                  </Button>
                  {inv.hosted_url && (
                    <a
                      href={inv.hosted_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[9px] border border-border-strong px-2.5 py-1 text-xs font-semibold text-text transition hover:border-accent hover:text-accent"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <CreateModal
          projectId={projectId}
          kind={modal}
          contacts={contacts}
          deliverables={deliverables}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
