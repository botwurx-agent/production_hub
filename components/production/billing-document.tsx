import {
  computeTotals,
  docMoney,
  type DocSnapshot,
} from "@/lib/billing-doc";
import { longDate } from "@/lib/format";

export type SignatureInfo = {
  signerName: string | null;
  signatureKind: string | null; // 'typed' | 'drawn'
  signatureData: string | null;
  acceptedAt: string | null;
};

// Read-only render of a billing document from its frozen snapshot. Used by the
// public accept page (and reusable for an in-app preview / PDF later).
export function BillingDocument({
  doc,
  logoUrl,
  signature,
}: {
  doc: DocSnapshot;
  logoUrl?: string | null;
  signature?: SignatureInfo | null;
}) {
  const totals = computeTotals(doc.lines, doc.discount);
  const fromLines = [
    doc.from.address,
    doc.from.phone,
    doc.from.email,
    doc.from.website,
  ].filter(Boolean);

  return (
    <div className="rounded-[16px] border border-border bg-surface p-6 shadow-sm sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mb-3 h-12 w-auto object-contain"
            />
          )}
          <div className="text-sm font-bold text-text">
            {doc.from.businessName || "Studio"}
          </div>
          {fromLines.length > 0 && (
            <div className="whitespace-pre-line text-xs text-text-muted">
              {fromLines.join("\n")}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-text">
            {doc.docLabel}
          </div>
          {doc.number && (
            <div className="mt-1 text-sm font-semibold text-text">
              {doc.number}
            </div>
          )}
          <div className="mt-2 space-y-0.5 text-xs text-text-muted">
            {doc.issueDate && (
              <div>
                <span className="text-text-faint">Issued </span>
                {longDate(doc.issueDate)}
              </div>
            )}
            {doc.dueDate && (
              <div>
                <span className="text-text-faint">Valid until </span>
                {longDate(doc.dueDate)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill to */}
      {(doc.billTo.name || doc.billTo.company || doc.billTo.email) && (
        <div className="mt-6 max-w-sm">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Prepared for
          </div>
          {doc.billTo.name && (
            <div className="text-sm font-semibold text-text">
              {doc.billTo.name}
            </div>
          )}
          {doc.billTo.company && (
            <div className="text-sm text-text-muted">{doc.billTo.company}</div>
          )}
          {doc.billTo.email && (
            <div className="text-xs text-text-faint">{doc.billTo.email}</div>
          )}
          {doc.billTo.reference && (
            <div className="text-xs text-text-faint">
              Ref: {doc.billTo.reference}
            </div>
          )}
        </div>
      )}

      {/* Lines */}
      <div className="mt-6">
        <div className="grid grid-cols-[1fr_5rem_3rem_6rem] gap-2 border-b-2 border-text/80 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
          <span>Description</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Amount</span>
        </div>
        {doc.lines.map((l, i) => {
          const amount = (l.rate || 0) * (l.qty || 0) * (1 + (l.tax_rate || 0) / 100);
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_5rem_3rem_6rem] gap-2 border-b border-border py-2 text-sm"
            >
              <span className="text-text">
                {l.description || "—"}
                {l.tax_rate ? (
                  <span className="ml-1 text-xs text-text-faint">
                    (+{l.tax_rate}% tax)
                  </span>
                ) : null}
              </span>
              <span className="text-right tabular-nums text-text-muted">
                {docMoney(l.rate || 0, doc.currency)}
              </span>
              <span className="text-right tabular-nums text-text-muted">
                {l.qty || 0}
              </span>
              <span className="text-right tabular-nums text-text">
                {docMoney(amount, doc.currency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between text-text-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {docMoney(totals.subtotal, doc.currency)}
            </span>
          </div>
          {totals.tax > 0 && (
            <div className="flex justify-between text-text-muted">
              <span>Tax</span>
              <span className="tabular-nums">
                {docMoney(totals.tax, doc.currency)}
              </span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-text-muted">
              <span>Discount</span>
              <span className="tabular-nums">
                {"−"}
                {docMoney(totals.discount, doc.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-text">
            <span>Total</span>
            <span className="tabular-nums">
              {docMoney(totals.total, doc.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes + terms */}
      {(doc.notes || doc.terms) && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {doc.notes && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Notes
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-text-muted">
                {doc.notes}
              </p>
            </div>
          )}
          {doc.terms && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Terms
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-text-muted">
                {doc.terms}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Signed acceptance */}
      {signature?.acceptedAt && (
        <div className="mt-8 rounded-[12px] border border-green/40 bg-green-bg/40 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-green">
            Accepted &amp; signed
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              {signature.signatureKind === "drawn" && signature.signatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signature.signatureData}
                  alt="Signature"
                  className="h-14 w-auto"
                />
              ) : (
                <div className="font-display text-2xl italic text-text">
                  {signature.signatureData || signature.signerName}
                </div>
              )}
              <div className="mt-1 border-t border-border pt-1 text-sm font-semibold text-text">
                {signature.signerName}
              </div>
            </div>
            <div className="text-xs text-text-muted">
              {longDate(signature.acceptedAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
