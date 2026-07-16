import {
  computeTotals,
  docMoney,
  fontStack,
  safeAccent,
  DEFAULT_DOC_STYLE,
  type DocSnapshot,
  type DocTemplate,
} from "@/lib/billing-doc";
import { longDate } from "@/lib/format";

export type SignatureInfo = {
  signerName: string | null;
  signatureKind: string | null; // 'typed' | 'drawn'
  signatureData: string | null;
  acceptedAt: string | null;
};

export type AttachmentLink = { name: string; url: string };

// Read-only render of a billing document from its frozen snapshot. Honors the
// document's style (template + accent color + font). Used by the public page and
// reusable for an in-app preview / PDF later.
export function BillingDocument({
  doc,
  logoUrl,
  signature,
  attachments,
}: {
  doc: DocSnapshot;
  logoUrl?: string | null;
  signature?: SignatureInfo | null;
  attachments?: AttachmentLink[] | null;
}) {
  const style = doc.style ?? DEFAULT_DOC_STYLE;
  const accent = safeAccent(style.accent);
  const template: DocTemplate = style.template ?? "classic";
  const totals = computeTotals(doc.lines, doc.discount);
  const fromLines = [
    doc.from.address,
    doc.from.phone,
    doc.from.email,
    doc.from.website,
  ].filter(Boolean);

  const businessName = doc.from.businessName || "Studio";

  const FromBlock = (
    <div className="min-w-0">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="mb-3 h-12 w-auto object-contain" />
      )}
      <div className="text-sm font-bold text-text">{businessName}</div>
      {fromLines.length > 0 && (
        <div className="whitespace-pre-line text-xs text-text-muted">
          {fromLines.join("\n")}
        </div>
      )}
    </div>
  );

  const MetaBlock = (
    <div className="mt-2 space-y-0.5 text-xs text-text-muted">
      {doc.number && (
        <div>
          <span className="text-text-faint">No. </span>
          {doc.number}
        </div>
      )}
      {doc.issueDate && (
        <div>
          <span className="text-text-faint">Issued </span>
          {longDate(doc.issueDate)}
        </div>
      )}
      {doc.dueDate && (
        <div>
          <span className="text-text-faint">
            {doc.kind === "invoice" ? "Due " : "Valid until "}
          </span>
          {longDate(doc.dueDate)}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm"
      style={{ fontFamily: fontStack(style.font) }}
    >
      {/* Header (template-specific) */}
      {template === "modern" ? (
        <>
          <div
            className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8"
            style={{ backgroundColor: accent }}
          >
            <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
              {doc.docLabel}
            </div>
            <div className="text-right text-xs text-white/85">
              {doc.number && (
                <div className="text-sm font-semibold text-white">
                  {doc.number}
                </div>
              )}
              {doc.issueDate && <div>Issued {longDate(doc.issueDate)}</div>}
              {doc.dueDate && (
                <div>
                  {doc.kind === "invoice" ? "Due " : "Valid until "}
                  {longDate(doc.dueDate)}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 pt-6 sm:px-8">{FromBlock}</div>
        </>
      ) : template === "bold" ? (
        <div className="px-6 pt-7 sm:px-8">
          <div
            className="font-display text-4xl font-black uppercase tracking-tight"
            style={{ color: accent }}
          >
            {doc.docLabel}
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
            {FromBlock}
            <div className="text-right">{MetaBlock}</div>
          </div>
        </div>
      ) : (
        // classic
        <div className="flex flex-wrap items-start justify-between gap-6 px-6 pt-6 sm:px-8">
          {FromBlock}
          <div className="text-right">
            <div
              className="font-display text-2xl font-extrabold uppercase tracking-tight"
              style={{ color: accent }}
            >
              {doc.docLabel}
            </div>
            {MetaBlock}
          </div>
        </div>
      )}

      <div className="px-6 pb-8 sm:px-8">
        {/* Bill to */}
        {(doc.billTo.name || doc.billTo.company || doc.billTo.email) && (
          <div className="mt-6 max-w-sm">
            <div
              className="mb-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
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
          <div
            className="grid grid-cols-[1fr_5rem_3rem_6rem] gap-2 border-b-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ borderColor: accent, color: accent }}
          >
            <span>Description</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Amount</span>
          </div>
          {doc.lines.map((l, i) => {
            const amount =
              (l.rate || 0) * (l.qty || 0) * (1 + (l.tax_rate || 0) / 100);
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_5rem_3rem_6rem] gap-2 border-b border-border py-2 text-sm"
              >
                <span className="text-text">
                  {l.description || "(no description)"}
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
            <div
              className="mt-1 flex justify-between rounded-[8px] px-2 py-1.5 text-base font-bold text-white"
              style={{ backgroundColor: accent }}
            >
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
                <div
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  Notes
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-text-muted">
                  {doc.notes}
                </p>
              </div>
            )}
            {doc.terms && (
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  Terms
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-text-muted">
                  {doc.terms}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mt-6">
            <div
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
              Attachments
            </div>
            <div className="mt-2 space-y-1.5">
              {attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-[9px] border border-border px-3 py-2 text-sm text-text transition hover:border-border-strong"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: accent }}
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span className="truncate font-medium">{a.name}</span>
                  <span className="ml-auto text-xs text-text-faint">Open</span>
                </a>
              ))}
            </div>
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
                {signature.signatureKind === "drawn" &&
                signature.signatureData ? (
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
    </div>
  );
}
