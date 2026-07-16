// Shared model for a billing document (estimate/proposal/invoice) snapshot. When
// a doc is sent we freeze this into billing_documents.snapshot so the shared (and
// signed) version can never be silently changed; the public page renders the
// snapshot, and the in-app preview reuses the same renderer + style.

export type DocKind = "invoice" | "estimate" | "proposal";

export type DocSnapshotLine = {
  description: string;
  rate: number;
  qty: number;
  tax_rate: number;
};

export type DocSnapshotAttachment = {
  name: string;
  storagePath: string;
};

// Visual style, editable per document (FreshBooks-style: template + theme color
// + font). Falls back to the studio defaults when a document leaves it unset.
export type DocStyle = {
  template: DocTemplate;
  accent: string; // hex color
  font: DocFont;
};

export type DocTemplate = "classic" | "modern" | "bold";
export type DocFont = "modern" | "classic";

export type DocSnapshot = {
  kind: DocKind;
  docLabel: string; // "Estimate" | "Proposal" | "Invoice"
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
  style: DocStyle;
  attachments: DocSnapshotAttachment[];
};

export const DOC_LABELS: Record<DocKind, string> = {
  invoice: "Invoice",
  estimate: "Estimate",
  proposal: "Proposal",
};

export function docLabel(kind: string): string {
  return DOC_LABELS[kind as DocKind] ?? "Document";
}

// Template + theme + font option sets, shared by the editor and the renderer.
export const DOC_TEMPLATES: { value: DocTemplate; label: string; hint: string }[] = [
  { value: "classic", label: "Classic", hint: "Clean, right-aligned title" },
  { value: "modern", label: "Modern", hint: "Accent header band" },
  { value: "bold", label: "Bold", hint: "Big title, accent totals" },
];

export const DOC_FONTS: { value: DocFont; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
];

// The six swatches mirror the reference editor; the last is a custom picker.
export const DOC_ACCENTS = [
  "#7c3aed", // purple
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#475569", // slate
  "#0891b2", // cyan
];

export const DEFAULT_DOC_STYLE: DocStyle = {
  template: "classic",
  accent: "#4f46e5",
  font: "modern",
};

const FONT_STACKS: Record<DocFont, string> = {
  modern:
    "'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  classic: "Georgia, 'Times New Roman', 'Iowan Old Style', serif",
};

export function fontStack(font: string): string {
  return FONT_STACKS[(font as DocFont) ?? "modern"] ?? FONT_STACKS.modern;
}

// Normalize a hex accent to a safe string (defends the inline-style + public page).
export function safeAccent(hex: string | null | undefined): string {
  const v = (hex ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : DEFAULT_DOC_STYLE.accent;
}

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
