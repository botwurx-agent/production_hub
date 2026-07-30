/**
 * Signed paperwork vocabulary. Lives outside the actions file because a
 * "use server" module can only export async functions and the UI needs these.
 */

/**
 * Kinds are drawn from what actually arrives at a boutique studio, and the
 * SCOPE column is the important part: an NDA or master agreement is signed once
 * per relationship and governs everything after it, so it belongs to the
 * account. A SOW or change order is per job.
 */
export const AGREEMENT_KIND = {
  nda: {
    label: "NDA",
    hue: "purple",
    scope: "account",
    hint: "Confidentiality, signed once per relationship",
  },
  msa: {
    label: "Master agreement",
    hue: "indigo",
    scope: "account",
    hint: "The umbrella contract that SOWs hang off",
  },
  sow: {
    label: "SOW",
    hue: "blue",
    scope: "project",
    hint: "Scope, deliverables and fees for one job",
  },
  change_order: {
    label: "Change order",
    hue: "amber",
    scope: "project",
    hint: "An amendment to a SOW",
  },
  other: {
    label: "Other",
    hue: "cyan",
    scope: "either",
    hint: "Anything else worth keeping on file",
  },
} as const;

export type AgreementKind = keyof typeof AGREEMENT_KIND;

export const AGREEMENT_KIND_ORDER: AgreementKind[] = [
  "nda",
  "msa",
  "sow",
  "change_order",
  "other",
];

export function isAgreementKind(v: string): v is AgreementKind {
  return v in AGREEMENT_KIND;
}

export function agreementKind(v: string | null | undefined): AgreementKind {
  return v && isAgreementKind(v) ? v : "sow";
}

/** Which side sent it. Inbound is the common case for a production company. */
export const AGREEMENT_DIRECTION = {
  inbound: { label: "Received", hint: "They sent it, we sign" },
  outbound: { label: "Sent", hint: "We sent it for them to sign" },
} as const;

export type AgreementDirection = keyof typeof AGREEMENT_DIRECTION;

export function agreementDirection(
  v: string | null | undefined
): AgreementDirection {
  return v === "outbound" ? "outbound" : "inbound";
}

/**
 * Signature state, derived from the two dates rather than stored, so it can
 * never disagree with them.
 */
export type SignState = "unsigned" | "partial" | "signed";

export const SIGN_STATE = {
  unsigned: { label: "Not signed", hue: "red" },
  partial: { label: "Awaiting signature", hue: "amber" },
  signed: { label: "Fully signed", hue: "green" },
} as const;

export function signState(a: {
  our_signed_at: string | null;
  their_signed_at: string | null;
}): SignState {
  const ours = Boolean(a.our_signed_at);
  const theirs = Boolean(a.their_signed_at);
  if (ours && theirs) return "signed";
  if (ours || theirs) return "partial";
  return "unsigned";
}

/**
 * True when a term has run out. Compared against a date resolved on the server
 * and passed in, so it cannot differ between the server render and hydration.
 */
export function isExpired(
  expires: string | null,
  todayIso: string
): boolean {
  return expires !== null && expires < todayIso;
}

/** A plain YYYY-MM-DD read as UTC, so no timezone shifts the day. */
export function fmtAgreementDay(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
