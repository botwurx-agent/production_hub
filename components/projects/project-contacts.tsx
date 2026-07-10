"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
  CATEGORIES,
  CATEGORY_HUE,
  POSITIONS,
  categoryLabel,
  normalizeCategory,
  type ContactCategory,
} from "@/lib/crew-positions";
import {
  addProjectContact,
  updateProjectContact,
  deleteProjectContact,
  type ContactInput,
} from "@/app/(app)/projects/[id]/contact-actions";

export type ContactRow = {
  id: string;
  name: string;
  type: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  rate: number | null;
  notes: string | null;
};

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
function money(n: number) {
  return `$${n.toLocaleString()}/day`;
}

type Row = { contact: ContactRow; editable: boolean };
type Tab = "all" | ContactCategory;

export function ProjectContacts({
  projectId,
  projectContacts,
  clientContacts,
  clientId,
  clientName,
}: {
  projectId: string;
  projectContacts: ContactRow[];
  clientContacts: ContactRow[];
  clientId: string | null;
  clientName: string | null;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<ContactInput | null>(null);
  const [pickClient, setPickClient] = useState(false);

  // One merged list: editable production contacts + read-only client contacts
  // (the linked client's people, always in the Client folder).
  const rows: Row[] = useMemo(
    () => [
      ...projectContacts.map((c) => ({ contact: c, editable: true })),
      ...clientContacts.map((c) => ({
        contact: { ...c, type: "client" as const },
        editable: false,
      })),
    ],
    [projectContacts, clientContacts]
  );

  const countFor = (t: Tab) =>
    t === "all"
      ? rows.length
      : rows.filter((r) => normalizeCategory(r.contact.type) === t).length;

  const visible =
    tab === "all"
      ? rows
      : rows.filter((r) => normalizeCategory(r.contact.type) === tab);

  const tabDefs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ key: c.key as Tab, label: c.plural })),
  ];

  // New contacts default to the active folder (Crew when on All).
  const defaultCategory: ContactCategory =
    tab === "all" ? "crew" : (tab as ContactCategory);

  return (
    <div>
      {/* Folder tabs */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabDefs.map((t) => {
            const active = tab === t.key;
            const hue = t.key === "all" ? "indigo" : CATEGORY_HUE[t.key];
            const n = countFor(t.key);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-transparent text-text shadow-sm"
                    : "border-border text-text-muted hover:bg-surface-2"
                }`}
                style={
                  active
                    ? { backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }
                    : undefined
                }
              >
                {t.key !== "all" && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--h-${hue})` }}
                  />
                )}
                {t.label}
                <span
                  className="rounded-pill px-1.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: active ? "var(--surface)" : "var(--surface-2)",
                    color: active ? `var(--h-${hue})` : "var(--text-faint)",
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {clientContacts.length > 0 && (
            <Button variant="secondary" onClick={() => setPickClient(true)}>
              + From {clientName ?? "client"}
            </Button>
          )}
          <Button onClick={() => setAdding(true)}>+ Add contact</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border py-14 text-center">
          <div
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[14px]"
            style={{ backgroundColor: "var(--h-orange-bg)", color: "var(--h-orange)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">
            {tab === "all" ? "No contacts yet" : `No ${tabDefs.find((t) => t.key === tab)?.label.toLowerCase()} yet`}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
            Add the people on this job: director, DP, crew, talent, and vendors.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            + Add contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <ContactCard
              key={r.contact.id}
              contact={r.contact}
              onEdit={r.editable ? () => setEditing(r.contact) : undefined}
            />
          ))}
        </div>
      )}

      {tab === "client" && clientId && clientContacts.length > 0 && (
        <Link
          href={`/clients/${clientId}`}
          className="mt-4 inline-block text-xs font-semibold text-accent hover:underline"
        >
          Manage {clientName ?? "client"} contacts &rarr;
        </Link>
      )}

      {(adding || editing || prefill) && (
        <ContactModal
          projectId={projectId}
          contact={editing}
          prefill={prefill}
          defaultCategory={defaultCategory}
          onClose={() => {
            setAdding(false);
            setEditing(null);
            setPrefill(null);
          }}
        />
      )}

      {pickClient && (
        <ClientPickerModal
          contacts={clientContacts}
          clientName={clientName}
          onPick={(c) => {
            setPrefill({
              name: c.name,
              type: defaultCategory,
              role: c.role ?? "",
              company: c.company ?? "",
              email: c.email ?? "",
              phone: c.phone ?? "",
              rate: c.rate,
              notes: c.notes ?? "",
            });
            setPickClient(false);
          }}
          onClose={() => setPickClient(false)}
        />
      )}
    </div>
  );
}

function ClientPickerModal({
  contacts,
  clientName,
  onPick,
  onClose,
}: {
  contacts: ContactRow[];
  clientName: string | null;
  onPick: (c: ContactRow) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? contacts.filter((c) =>
        `${c.name} ${c.role ?? ""} ${c.email ?? ""} ${c.company ?? ""}`
          .toLowerCase()
          .includes(query)
      )
    : contacts;

  return (
    <Modal open onClose={onClose} title={`Add from ${clientName ?? "client"}`} size="md">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Pull an existing {clientName ?? "client"} contact into this project&apos;s
          roster. You can set their job role and rate on the next step.
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts…"
          autoFocus
          className={inputCls}
        />
        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-faint">
              No contacts found.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick(c)}
                className="flex w-full items-center gap-3 rounded-[11px] border border-border p-2.5 text-left transition hover:border-border-strong hover:bg-surface-2"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: "var(--h-orange-bg)", color: "var(--h-orange)" }}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-text">
                    {c.name}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {[c.role, c.email].filter(Boolean).join(" · ") || "Client contact"}
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-xs font-semibold text-accent">
                  Add →
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function ContactCard({
  contact,
  onEdit,
}: {
  contact: ContactRow;
  onEdit?: () => void;
}) {
  const cat = normalizeCategory(contact.type);
  const hue = CATEGORY_HUE[cat];
  const sub = [contact.role, contact.company].filter(Boolean).join(" · ");
  return (
    <div
      className="group flex flex-col rounded-[16px] border border-border bg-surface p-4 shadow-sm transition hover:shadow-md"
      style={{ borderTop: `3px solid var(--h-${hue})` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
        >
          {initials(contact.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-text">{contact.name}</p>
          </div>
          {sub ? (
            <p className="truncate text-xs text-text-muted">{sub}</p>
          ) : (
            <p className="truncate text-xs text-text-faint">{categoryLabel(cat)}</p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-text-faint opacity-0 transition hover:text-text group-hover:opacity-100"
            aria-label="Edit contact"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-pill px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
        >
          {categoryLabel(cat)}
        </span>
        {contact.rate != null && (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
            {money(contact.rate)}
          </span>
        )}
      </div>

      {(contact.email || contact.phone) && (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-[13px]">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-text-muted transition hover:text-accent"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
              <span className="truncate">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 text-text-muted transition hover:text-accent"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="truncate">{contact.phone}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ContactModal({
  projectId,
  contact,
  prefill,
  defaultCategory,
  onClose,
}: {
  projectId: string;
  contact: ContactRow | null;
  prefill?: ContactInput | null;
  defaultCategory: ContactCategory;
  onClose: () => void;
}) {
  const router = useRouter();
  const empty = (cat: ContactCategory): ContactInput => ({
    name: "",
    type: cat,
    role: "",
    company: "",
    email: "",
    phone: "",
    rate: null,
    notes: "",
  });
  const [form, setForm] = useState<ContactInput>(
    contact
      ? {
          name: contact.name,
          type: normalizeCategory(contact.type),
          role: contact.role ?? "",
          company: contact.company ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          rate: contact.rate,
          notes: contact.notes ?? "",
        }
      : (prefill ?? empty(defaultCategory))
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function set<K extends keyof ContactInput>(k: K, v: ContactInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const cat = normalizeCategory(form.type);
  const hue = CATEGORY_HUE[cat];

  function save(addAnother: boolean) {
    if (!form.name.trim()) return setError("Add a name.");
    setError(null);
    start(async () => {
      const res = contact
        ? await updateProjectContact(projectId, contact.id, form)
        : await addProjectContact(projectId, form);
      if (res?.error) return setError(res.error);
      router.refresh();
      if (addAnother && !contact) {
        // Keep the category, clear the person, stay open to add the next.
        setForm(empty(cat));
      } else {
        onClose();
      }
    });
  }

  function remove() {
    if (!contact) return;
    start(async () => {
      await deleteProjectContact(projectId, contact.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={contact ? "Edit contact" : "Add contact"} size="md">
      <div className="space-y-4">
        {/* Category picker (the "folder" this contact goes in) */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
            Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const active = cat === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    // Clear position when switching folders so the list matches.
                    setForm((f) => ({ ...f, type: c.key, role: "" }));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-semibold transition"
                  style={
                    active
                      ? {
                          backgroundColor: `var(--h-${c.hue}-bg)`,
                          color: `var(--h-${c.hue})`,
                          borderColor: `var(--h-${c.hue})`,
                        }
                      : { borderColor: "var(--border)", color: "var(--text-muted)" }
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--h-${c.hue})` }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Full name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Alex Rivera"
            autoFocus
            className={inputCls}
          />
        </Field>

        <Field label="Position">
          <PositionCombobox
            category={cat}
            hue={hue}
            value={form.role ?? ""}
            onChange={(v) => set("role", v)}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Company" className="flex-1">
            <input
              value={form.company ?? ""}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Studio / agency"
              className={inputCls}
            />
          </Field>
          <Field label="Rate (per day)" className="w-32">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-faint">
                $
              </span>
              <input
                type="number"
                min={0}
                value={form.rate ?? ""}
                onChange={(e) =>
                  set("rate", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="0"
                className={`${inputCls} pl-6`}
              />
            </div>
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Email" className="flex-1">
            <input
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@studio.com"
              className={inputCls}
            />
          </Field>
          <Field label="Phone" className="flex-1">
            <input
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Availability, agency, special notes…"
            className={`${inputCls} min-h-[60px]`}
          />
        </Field>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          {contact ? (
            <button
              onClick={remove}
              disabled={busy}
              className="text-sm font-semibold text-red hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!contact && (
              <Button variant="secondary" onClick={() => save(true)} disabled={busy}>
                Save &amp; add another
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
        {label}
      </label>
      {children}
    </div>
  );
}

// Searchable position picker: filters the curated list for the chosen category,
// opens on focus, and accepts free text. (Fixes the reference's list that
// wouldn't open.)
function PositionCombobox({
  category,
  hue,
  value,
  onChange,
}: {
  category: ContactCategory;
  hue: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const all = POSITIONS[category] ?? [];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = q ? all.filter((p) => p.toLowerCase().includes(q)) : all;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search or type a position…"
          className={`${inputCls} pr-9`}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint"
          aria-label="Toggle positions"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-lg">
          {matches.map((p) => {
            const selected = p === value;
            return (
              <button
                key={p}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(p);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-[9px] px-3 py-1.5 text-left text-sm transition ${
                  selected ? "font-semibold" : "text-text-muted hover:bg-surface-2"
                }`}
                style={selected ? { backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` } : undefined}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
