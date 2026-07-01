"use client";

import { useTransition } from "react";
import { deleteContact } from "@/app/(app)/clients/actions";
import type { Contact } from "@/lib/database.types";

function ContactRow({
  contact,
  revalidate,
}: {
  contact: Contact;
  revalidate: string;
}) {
  const [pending, start] = useTransition();
  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-[11px] border border-border bg-surface px-3 py-2.5 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-text">{contact.name}</span>
          {contact.role && (
            <span className="text-xs text-text-faint">{contact.role}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-text-muted">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="hover:text-accent"
            >
              {contact.email}
            </a>
          )}
          {contact.phone && <span>{contact.phone}</span>}
        </div>
      </div>
      <button
        onClick={() => start(() => deleteContact(contact.id, revalidate))}
        aria-label="Remove contact"
        className="shrink-0 rounded-[8px] p-1 text-text-faint transition hover:bg-red-bg hover:text-red"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </li>
  );
}

export function ContactList({
  contacts,
  revalidate,
}: {
  contacts: Contact[];
  revalidate: string;
}) {
  if (contacts.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-faint">
        No contacts yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {contacts.map((c) => (
        <ContactRow key={c.id} contact={c} revalidate={revalidate} />
      ))}
    </ul>
  );
}
