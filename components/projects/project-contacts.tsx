"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  addProjectContact,
  updateProjectContact,
  deleteProjectContact,
  type ContactInput,
} from "@/app/(app)/projects/[id]/contact-actions";

export type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
};

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

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
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-8">
      {/* This production's roster */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-text">
              This production
            </h2>
            <span className="text-xs font-semibold text-text-faint">
              {projectContacts.length}
            </span>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add contact
          </Button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Crew, talent, and vendors for this job.
        </p>

        {projectContacts.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border py-10 text-center">
            <p className="text-sm text-text-faint">
              No production contacts yet. Add your director, DP, crew, or vendors.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectContacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onEdit={() => setEditing(c)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Client & agency contacts (managed on the client) */}
      {clientId && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-text">
              Client &amp; agency
            </h2>
            <span className="text-xs font-semibold text-text-faint">
              {clientContacts.length}
            </span>
          </div>
          {clientContacts.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border py-8 text-center">
              <p className="text-sm text-text-faint">
                No contacts on{clientName ? ` ${clientName}` : " the client"} yet.
              </p>
              <Link
                href={`/clients/${clientId}`}
                className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
              >
                Add them on the client &rarr;
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clientContacts.map((c) => (
                  <ContactCard key={c.id} contact={c} readOnly />
                ))}
              </div>
              <Link
                href={`/clients/${clientId}`}
                className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
              >
                Manage on {clientName ?? "the client"} &rarr;
              </Link>
            </>
          )}
        </section>
      )}

      {(adding || editing) && (
        <ContactModal
          projectId={projectId}
          contact={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onEdit,
  readOnly = false,
}: {
  contact: ContactRow;
  onEdit?: () => void;
  readOnly?: boolean;
}) {
  const sub = [contact.role, contact.company].filter(Boolean).join(" · ");
  return (
    <div className="group flex flex-col rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {initials(contact.name) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text">{contact.name}</p>
          {sub && <p className="truncate text-xs text-text-muted">{sub}</p>}
        </div>
        {!readOnly && onEdit && (
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
  onClose,
}: {
  projectId: string;
  contact: ContactRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ContactInput>({
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    company: contact?.company ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function set(k: keyof ContactInput, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    if (!form.name.trim()) return setError("Add a name.");
    setError(null);
    start(async () => {
      const res = contact
        ? await updateProjectContact(projectId, contact.id, form)
        : await addProjectContact(projectId, form);
      if (res?.error) setError(res.error);
      else {
        router.refresh();
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
    <Modal open onClose={onClose} title={contact ? "Edit contact" : "Add contact"}>
      <div className="space-y-3">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Name"
          autoFocus
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            value={form.role ?? ""}
            onChange={(e) => set("role", e.target.value)}
            placeholder="Role (e.g. Director, DP)"
            className={inputCls}
          />
          <input
            value={form.company ?? ""}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Company"
            className={inputCls}
          />
        </div>
        <input
          value={form.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
          placeholder="Email"
          className={inputCls}
        />
        <input
          value={form.phone ?? ""}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="Phone"
          className={inputCls}
        />
        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
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
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
