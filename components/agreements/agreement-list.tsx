"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import {
  addAgreement,
  updateAgreement,
  deleteAgreement,
  uploadAgreementFile,
  getAgreementFileUrl,
  draftFromSow,
  applySowDeliverables,
  type AgreementInput,
} from "@/app/(app)/agreement-actions";
import { useAiEnabled } from "@/components/ai/ai-availability";
import {
  AGREEMENT_KIND,
  AGREEMENT_KIND_ORDER,
  AGREEMENT_DIRECTION,
  agreementKind,
  agreementDirection,
  fmtAgreementDay,
  isExpired,
  signState,
  SIGN_STATE,
  type AgreementKind,
} from "@/lib/agreements";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";
import type { Agreement } from "@/lib/database.types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const field =
  "w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none transition focus:border-border-strong";
const label =
  "mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-faint";

/** A deliverable proposed by reading a SOW, before the producer accepts it. */
type SowRow = {
  name: string;
  spec: string | null;
  dueDate: string | null;
  amount: number | null;
  include: boolean;
};

/** An agreement inherited from the account, shown read-only on a project. */
export type InheritedAgreement = {
  id: string;
  kind: string;
  title: string;
  counterparty: string | null;
  effective_date: string | null;
  expires_date: string | null;
  our_signed_at: string | null;
  their_signed_at: string | null;
  clientId: string;
  clientName: string;
};

function emptyInput(
  scope: { clientId: string | null; projectId: string | null },
  kind: AgreementKind
): AgreementInput {
  return {
    kind,
    direction: "inbound",
    title: "",
    reference: null,
    counterparty: null,
    effectiveDate: null,
    expiresDate: null,
    ourSignerName: null,
    ourSignedAt: null,
    theirSignerName: null,
    theirSignedAt: null,
    value: null,
    notes: null,
    parentId: null,
    clientId: scope.clientId,
    projectId: scope.projectId,
  };
}

function toInput(a: Agreement): AgreementInput {
  return {
    kind: a.kind,
    direction: a.direction,
    title: a.title,
    reference: a.reference,
    counterparty: a.counterparty,
    effectiveDate: a.effective_date,
    expiresDate: a.expires_date,
    ourSignerName: a.our_signer_name,
    ourSignedAt: a.our_signed_at,
    theirSignerName: a.their_signer_name,
    theirSignedAt: a.their_signed_at,
    value: a.value === null ? null : Number(a.value),
    notes: a.notes,
    parentId: a.parent_id,
    clientId: a.client_id,
    projectId: a.project_id,
  };
}

/**
 * The paperwork on file for an account or a project. Answers the question that
 * actually costs you at 9pm the night before a shoot: is there an NDA in place,
 * and what did we sign up to deliver.
 */
export function AgreementList({
  agreements,
  inherited = [],
  clientId = null,
  projectId = null,
  todayIso,
  defaultCounterparty = null,
  /** Kinds offered here. A project shows SOWs, an account shows NDAs and MSAs. */
  kinds = AGREEMENT_KIND_ORDER,
  /** Possible parents, so a SOW can point at the MSA it is governed by. */
  parents = [],
}: {
  agreements: Agreement[];
  inherited?: InheritedAgreement[];
  clientId?: string | null;
  projectId?: string | null;
  todayIso: string;
  defaultCounterparty?: string | null;
  kinds?: AgreementKind[];
  parents?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<Agreement | "new" | null>(null);

  function remove(a: Agreement) {
    if (
      !window.confirm(
        `Delete "${a.title || AGREEMENT_KIND[agreementKind(a.kind)].label}"? The stored document is deleted too.`
      )
    )
      return;
    start(async () => {
      await deleteAgreement(a.id, { clientId, projectId });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-text">Agreements</h3>
          <p className="text-xs text-text-muted">
            {agreements.length === 0
              ? "NDAs, master agreements, SOWs and change orders on file."
              : `${agreements.length} on file.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          + Add an agreement
        </Button>
      </div>

      {/* Inherited from the account: a SOW is governed by these, so the project
          should say they exist without pretending to own them. */}
      {inherited.length > 0 && (
        <div className="mb-3 rounded-[12px] border border-border bg-surface-2 p-2.5">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            In place with the client
          </div>
          <ul className="space-y-1">
            {inherited.map((a) => {
              const k = AGREEMENT_KIND[agreementKind(a.kind)];
              const state = signState(a);
              const expired = isExpired(a.expires_date, todayIso);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="rounded-pill px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: `var(--h-${k.hue}-bg)`,
                      color: `var(--h-${k.hue})`,
                    }}
                  >
                    {k.label}
                  </span>
                  <span className="text-text">{a.title || k.label}</span>
                  {expired ? (
                    <span className="font-semibold text-red">
                      expired {fmtAgreementDay(a.expires_date)}
                    </span>
                  ) : (
                    <span className="text-text-faint">
                      {SIGN_STATE[state].label}
                      {a.effective_date && ` · from ${fmtAgreementDay(a.effective_date)}`}
                    </span>
                  )}
                  <Link
                    href={`/clients/${a.clientId}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    on {a.clientName}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {agreements.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          Nothing on file yet. Add a received NDA or SOW so it is findable later.
        </p>
      ) : (
        <div className="space-y-2">
          {agreements.map((a) => (
            <AgreementRow
              key={a.id}
              agreement={a}
              todayIso={todayIso}
              onEdit={() => setEditing(a)}
              onDelete={() => remove(a)}
              busy={busy}
            />
          ))}
        </div>
      )}

      {editing && (
        <AgreementModal
          agreement={editing === "new" ? null : editing}
          scope={{ clientId, projectId }}
          kinds={kinds}
          parents={parents}
          defaultCounterparty={defaultCounterparty}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AgreementRow({
  agreement: a,
  todayIso,
  onEdit,
  onDelete,
  busy,
}: {
  agreement: Agreement;
  todayIso: string;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const k = AGREEMENT_KIND[agreementKind(a.kind)];
  const dir = AGREEMENT_DIRECTION[agreementDirection(a.direction)];
  const state = signState(a);
  const s = SIGN_STATE[state];
  const expired = isExpired(a.expires_date, todayIso);

  return (
    <div className="rounded-[12px] border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: `var(--h-${k.hue}-bg)`, color: `var(--h-${k.hue})` }}
            >
              {k.label}
            </span>
            <span className="text-sm font-semibold text-text">
              {a.title || k.label}
              {a.reference && (
                <span className="ml-1 font-normal text-text-muted">{a.reference}</span>
              )}
            </span>
          </div>
          <div className="mt-1 text-xs text-text-muted">
            {[
              a.counterparty,
              dir.label,
              a.effective_date && `effective ${fmtAgreementDay(a.effective_date)}`,
              a.value !== null && money.format(Number(a.value)),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {expired ? (
            <span
              title={`Term ended ${fmtAgreementDay(a.expires_date)}`}
              className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "var(--h-red-bg)", color: "var(--h-red)" }}
            >
              Expired
            </span>
          ) : (
            <span
              className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ background: `var(--h-${s.hue}-bg)`, color: `var(--h-${s.hue})` }}
            >
              {s.label}
            </span>
          )}
          {a.storage_path && <FileButton id={a.id} name={a.file_name} />}
          <button
            onClick={onEdit}
            className="rounded-[7px] px-2 py-1 text-xs font-semibold text-accent transition hover:bg-surface-2"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
            aria-label="Delete agreement"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Who signed, spelled out: "awaiting signature" is only useful if you
          can see which side is missing. */}
      {(a.our_signed_at || a.their_signed_at) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-[11px] text-text-muted">
          <span>
            Us:{" "}
            {a.our_signed_at ? (
              <span className="text-text">
                {a.our_signer_name ? `${a.our_signer_name}, ` : ""}
                {fmtAgreementDay(a.our_signed_at)}
              </span>
            ) : (
              <span className="text-amber">not signed</span>
            )}
          </span>
          <span>
            Them:{" "}
            {a.their_signed_at ? (
              <span className="text-text">
                {a.their_signer_name ? `${a.their_signer_name}, ` : ""}
                {fmtAgreementDay(a.their_signed_at)}
              </span>
            ) : (
              <span className="text-amber">not signed</span>
            )}
          </span>
        </div>
      )}

      {a.notes && (
        <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-xs text-text-muted">
          {a.notes}
        </p>
      )}
    </div>
  );
}

/** Signs on click rather than on page load: most documents are never opened. */
function FileButton({ id, name }: { id: string; name: string | null }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        const res = await getAgreementFileUrl(id);
        setLoading(false);
        if ("error" in res) toast(res.error, "error");
        else window.open(res.url, "_blank", "noopener");
      }}
      disabled={loading}
      title={name ?? "Open the document"}
      className="grid h-7 w-7 place-items-center rounded-[7px] text-text-muted transition hover:bg-surface-2 hover:text-accent"
      aria-label="Open the document"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </button>
  );
}

function AgreementModal({
  agreement,
  scope,
  kinds,
  parents,
  defaultCounterparty,
  onClose,
}: {
  agreement: Agreement | null;
  scope: { clientId: string | null; projectId: string | null };
  kinds: AgreementKind[];
  parents: { id: string; label: string }[];
  defaultCounterparty: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AgreementInput>(() => {
    if (agreement) return toInput(agreement);
    const base = emptyInput(scope, kinds[0] ?? "sow");
    return { ...base, counterparty: defaultCounterparty };
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiEnabled = useAiEnabled();

  // Reading is a DRAFT: it fills the form and proposes deliverables, and
  // nothing is written until Save. `before` makes a bad read one click to undo,
  // the same contract as the invoice extractor and the composer's Polish.
  const [reading, setReading] = useState(false);
  const [filled, setFilled] = useState<string[] | null>(null);
  const [before, setBefore] = useState<AgreementInput | null>(null);
  const [proposed, setProposed] = useState<SowRow[] | null>(null);
  const [governedByNote, setGovernedByNote] = useState<string | null>(null);

  function set<K extends keyof AgreementInput>(k: K, v: AgreementInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function readDocument(f: File) {
    setReading(true);
    setFilled(null);
    const fd = new FormData();
    fd.set("file", f);
    const res = await draftFromSow(fd);
    setReading(false);
    if ("error" in res) {
      toast(res.error, "error");
      return;
    }
    const d = res.draft;
    setBefore(form);

    const got: string[] = [];
    setForm((prev) => {
      const next = { ...prev };
      if (d.title) { next.title = d.title; got.push("title"); }
      if (d.reference) { next.reference = d.reference; got.push("reference"); }
      if (d.counterparty) { next.counterparty = d.counterparty; got.push("counterparty"); }
      if (d.effectiveDate) { next.effectiveDate = d.effectiveDate; got.push("effective date"); }
      if (d.total !== null) { next.value = d.total; got.push("total value"); }
      if (d.ourSignerName) { next.ourSignerName = d.ourSignerName; got.push("our signer"); }
      if (d.ourSignedAt) { next.ourSignedAt = d.ourSignedAt; got.push("our signature date"); }
      if (d.theirSignerName) { next.theirSignerName = d.theirSignerName; got.push("their signer"); }
      if (d.theirSignedAt) { next.theirSignedAt = d.theirSignedAt; got.push("their signature date"); }
      // Payment terms have no structured home on the receivable side yet, so
      // they go into notes where they stay readable without reopening the PDF.
      if (d.paymentTerms) {
        next.notes = [prev.notes, `Payment terms: ${d.paymentTerms}`]
          .filter(Boolean)
          .join("\n\n");
        got.push("payment terms (into notes)");
      }
      return next;
    });

    setGovernedByNote(d.governedBy);
    setProposed(
      d.deliverables.map((x) => ({
        name: x.name,
        spec: x.spec,
        dueDate: x.dueDate,
        amount: x.amount,
        include: true,
      }))
    );
    setFilled(got);
  }

  function undoRead() {
    if (!before) return;
    setForm(before);
    setBefore(null);
    setFilled(null);
    setProposed(null);
    setGovernedByNote(null);
  }

  async function save() {
    if (!form.title.trim()) {
      toast("Give it a title so it is findable.", "error");
      return;
    }
    setSaving(true);
    const res = agreement
      ? await updateAgreement(agreement.id, form)
      : await addAgreement(form);

    if ("error" in res) {
      setSaving(false);
      toast(res.error, "error");
      return;
    }

    const id = agreement ? agreement.id : (res as { ok: true; id: string }).id;
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAgreementFile(id, scope, fd);
      if ("error" in up) {
        // The record saved; only the file failed. Say exactly that so the
        // producer does not re-enter an agreement that already exists.
        setSaving(false);
        toast(`Saved, but the file did not attach: ${up.error}`, "error");
        router.refresh();
        onClose();
        return;
      }
    }
    // The deliverables the producer left ticked. Applied after the agreement
    // exists, and reported separately: a failure here must not read as though
    // the agreement itself did not save.
    const rows = (proposed ?? []).filter((r) => r.include);
    if (rows.length > 0 && scope.projectId) {
      const applied = await applySowDeliverables(
        scope.projectId,
        rows.map((r) => ({
          name: r.name,
          spec: r.spec,
          dueDate: r.dueDate,
          amount: r.amount,
        }))
      );
      if ("error" in applied) {
        setSaving(false);
        toast(`Agreement saved, but the deliverables did not: ${applied.error}`, "error");
        router.refresh();
        onClose();
        return;
      }
      toast(
        `Saved, and added ${applied.created} deliverable${applied.created === 1 ? "" : "s"}.`,
        "success"
      );
    }

    setSaving(false);
    router.refresh();
    onClose();
  }

  const k = AGREEMENT_KIND[agreementKind(form.kind)];

  return (
    <Modal
      open
      onClose={onClose}
      title={agreement ? "Edit agreement" : "Add an agreement"}
      size="lg"
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Type</span>
            <select
              value={form.kind}
              onChange={(e) => set("kind", e.target.value)}
              className={field}
            >
              {kinds.map((key) => (
                <option key={key} value={key}>
                  {AGREEMENT_KIND[key].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-faint">{k.hint}</p>
          </div>
          <div>
            <span className={label}>Direction</span>
            <select
              value={form.direction}
              onChange={(e) => set("direction", e.target.value)}
              className={field}
            >
              {(["inbound", "outbound"] as const).map((d) => (
                <option key={d} value={d}>
                  {AGREEMENT_DIRECTION[d].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-faint">
              {AGREEMENT_DIRECTION[agreementDirection(form.direction)].hint}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <span className={label}>Title</span>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Hint Rebrand Launch Video"
              className={field}
            />
          </div>
          <div>
            <span className={label}>Their reference</span>
            <input
              value={form.reference ?? ""}
              onChange={(e) => set("reference", e.target.value || null)}
              placeholder="SOW #1"
              className={field}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Counterparty</span>
            <input
              value={form.counterparty ?? ""}
              onChange={(e) => set("counterparty", e.target.value || null)}
              placeholder="Hint, Inc."
              className={field}
            />
          </div>
          <div>
            <span className={label}>Total value (optional)</span>
            <input
              type="number"
              step="0.01"
              value={form.value ?? ""}
              onChange={(e) =>
                set("value", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="0.00"
              className={`${field} text-right tabular-nums`}
            />
          </div>
        </div>

        {parents.length > 0 && (
          <div>
            <span className={label}>Governed by</span>
            <select
              value={form.parentId ?? ""}
              onChange={(e) => set("parentId", e.target.value || null)}
              className={field}
            >
              <option value="">Nothing, it stands alone</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-faint">
              A SOW is usually governed by a master agreement.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Effective date</span>
            <input
              type="date"
              value={form.effectiveDate ?? ""}
              onChange={(e) => set("effectiveDate", e.target.value || null)}
              className={field}
            />
          </div>
          <div>
            <span className={label}>Expires (optional)</span>
            <input
              type="date"
              value={form.expiresDate ?? ""}
              onChange={(e) => set("expiresDate", e.target.value || null)}
              className={field}
            />
          </div>
        </div>

        <div className="rounded-[10px] border border-border p-2.5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Signatures
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>We signed</span>
              <input
                type="date"
                value={form.ourSignedAt ?? ""}
                onChange={(e) => set("ourSignedAt", e.target.value || null)}
                className={field}
              />
              <input
                value={form.ourSignerName ?? ""}
                onChange={(e) => set("ourSignerName", e.target.value || null)}
                placeholder="Who signed for us"
                className={`${field} mt-1.5`}
              />
            </div>
            <div>
              <span className={label}>They signed</span>
              <input
                type="date"
                value={form.theirSignedAt ?? ""}
                onChange={(e) => set("theirSignedAt", e.target.value || null)}
                className={field}
              />
              <input
                value={form.theirSignerName ?? ""}
                onChange={(e) => set("theirSignerName", e.target.value || null)}
                placeholder="Who signed for them"
                className={`${field} mt-1.5`}
              />
            </div>
          </div>
        </div>

        <div>
          <span className={label}>Document</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              // Read the selection before clearing the input: a FileList is a
              // live view of it, so clearing first empties the list.
              const picked = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!picked) return;
              if (picked.size > MAX_UPLOAD_BYTES) {
                toast(
                  `That file is ${formatBytes(picked.size)}, over the ${formatBytes(
                    MAX_UPLOAD_BYTES
                  )} upload limit.`,
                  "error"
                );
                return;
              }
              setFile(picked);
              // Reading a received SOW is the point of attaching it here, so it
              // runs on pick. Still a draft, still confirmed before saving.
              if (aiEnabled && !agreement && agreementKind(form.kind) === "sow") {
                void readDocument(picked);
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {agreement?.storage_path ? "Replace file" : "Attach the signed PDF"}
            </Button>
            {file ? (
              <span className="text-xs text-text-muted">{file.name}</span>
            ) : agreement?.file_name ? (
              <span className="text-xs text-text-muted">{agreement.file_name} attached</span>
            ) : null}
            {aiEnabled && file && !reading && (
              <button
                type="button"
                onClick={() => void readDocument(file)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Read it again
              </button>
            )}
          </div>
          {aiEnabled && !file && !agreement && agreementKind(form.kind) === "sow" && (
            <p className="mt-1 text-[11px] text-text-faint">
              Attach a received SOW and the fields below fill themselves, with its
              deliverables offered for the project. You check them before saving.
            </p>
          )}

          {reading && (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 py-2 text-xs text-text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Reading the document...
            </div>
          )}

          {!reading && filled && (
            <div className="mt-2 rounded-[10px] border border-amber bg-amber-bg px-2.5 py-2 text-[11px] leading-relaxed text-amber">
              {filled.length === 0 ? (
                <span className="font-semibold">
                  Nothing could be read off that document. Fill the fields in by hand.
                </span>
              ) : (
                <>
                  <span className="font-semibold">
                    Filled from the document: {filled.join(", ")}.
                  </span>{" "}
                  Check the total and the dates against the PDF before saving.
                </>
              )}
              {governedByNote && (
                <div className="mt-1">
                  It says it is governed by:{" "}
                  <span className="font-semibold">{governedByNote}</span>. File that
                  on the client if it is not already there.
                </div>
              )}
              {before && (
                <button
                  type="button"
                  onClick={undoRead}
                  className="ml-1 font-semibold underline"
                >
                  Undo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Deliverables the document names. Applied only on request, and only to
            the rows still ticked, so a misread line is dropped rather than
            corrected after the fact. */}
        {proposed !== null && proposed.length > 0 && scope.projectId && (
          <div className="rounded-[10px] border border-border p-2.5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Deliverables in this SOW
              </span>
              <span className="text-[11px] text-text-muted">
                {proposed.filter((r) => r.include).length} of {proposed.length} selected
                {proposed.some((r) => r.amount !== null) && (
                  <>
                    {" · "}
                    {money.format(
                      proposed
                        .filter((r) => r.include)
                        .reduce((n, r) => n + (r.amount ?? 0), 0)
                    )}
                  </>
                )}
              </span>
            </div>
            <ul className="space-y-1">
              {proposed.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex items-center gap-2 rounded-[8px] bg-surface-2 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) =>
                      setProposed((prev) =>
                        prev
                          ? prev.map((x, j) =>
                              j === i ? { ...x, include: e.target.checked } : x
                            )
                          : prev
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-text">
                    {r.name}
                    {r.spec && (
                      <span className="text-text-faint"> · {r.spec}</span>
                    )}
                  </span>
                  {r.dueDate && (
                    <span className="shrink-0 text-[11px] text-text-faint">
                      {fmtAgreementDay(r.dueDate)}
                    </span>
                  )}
                  {r.amount !== null && (
                    <span className="shrink-0 text-xs font-bold tabular-nums text-text">
                      {money.format(r.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-text-faint">
              Adding these creates them on the Delivery page with their fees. They
              are appended, so nothing already there is replaced.
            </p>
          </div>
        )}

        <div>
          <span className={label}>Notes</span>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            rows={3}
            placeholder="Payment terms, usage rights, anything worth remembering without reopening the PDF."
            className={`${field} resize-y`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : agreement ? "Save changes" : "Add agreement"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
