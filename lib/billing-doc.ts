// Shared model for a billing document (estimate/invoice) snapshot. When a doc is
// sent for signature we freeze this into billing_documents.snapshot so the signed
// version can never be silently changed; the public accept page renders the
// snapshot, and the in-app preview can reuse the same renderer.

export type DocSnapshotLine = {
  description: string;
  rate: number;
  qty: number;
  tax_rate: number;
};

export type DocSnapshot = {
  kind: "invoice" | "estimate";
  docLabel: string; // "Estimate" | "Invoice"
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  from: {
    businessName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  billTo: {
    name: string | null;
    company: string | null;
    email: string | null;
    reference: string | null;
  };
  lines: DocSnapshotLine[];
  currency: string;
  discount: number;
  notes: string | null;
  terms: string | null;
};

export function computeTotals(lines: DocSnapshotLine[], discount: number) {
  const subtotal = lines.reduce((s, l) => s + (l.rate || 0) * (l.qty || 0), 0);
  const tax = lines.reduce(
    (s, l) => s + (l.rate || 0) * (l.qty || 0) * ((l.tax_rate || 0) / 100),
    0
  );
  const d = discount || 0;
  return { subtotal, tax, discount: d, total: subtotal + tax - d };
}

export function docMoney(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `$${(n || 0).toFixed(2)}`;
  }
}
