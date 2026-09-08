"use client";

import { useRef, useState, useTransition } from "react";
import { submitContact, type ContactResult } from "@/app/(marketing)/contact/actions";
import { CONTACT_TOPICS, LIMITS } from "@/lib/contact";

/**
 * The contact form.
 *
 * The limits and the topic list are imported from lib/contact rather than
 * retyped, so what the form allows and what the server accepts cannot drift.
 * The server is still the authority: everything checked here is checked again
 * there, because a form is a convenience and not a boundary.
 */

const field =
  "w-full rounded-[11px] border border-border bg-surface px-3.5 py-2.5 text-[15px] text-text outline-none transition placeholder:text-text-faint focus:border-accent focus:ring-2 focus:ring-accent-soft";

function Label({ htmlFor, children, optional }: { htmlFor: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-[13px] font-semibold text-text">
      {children}
      {optional && <span className="text-[12px] font-medium text-text-faint">optional</span>}
    </label>
  );
}

export function ContactForm({ inbox }: { inbox: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContactResult | null>(null);
  const [count, setCount] = useState(0);
  // When the form was rendered, so the server can tell a person from a script
  // that posts on load. A ref rather than state: it must never change.
  const startedAt = useRef(Date.now());

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("startedAt", String(startedAt.current));
    start(async () => setResult(await submitContact(form)));
  }

  if (result?.ok) {
    return (
      <div className="rounded-[20px] border border-border bg-surface p-8 shadow-sm sm:p-10">
        <div
          className="grid h-12 w-12 place-items-center rounded-full"
          style={{ backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5 9 17.5 20 6.5" />
          </svg>
        </div>
        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-text">
          Got it. Thank you.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
          It goes to a person, not a queue, and you will hear back within a
          working day. If it is urgent, write to{" "}
          <a className="font-semibold text-accent hover:underline" href={`mailto:${inbox}`}>
            {inbox}
          </a>
          .
        </p>
      </div>
    );
  }

  const err = result && !result.ok ? result : null;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[20px] border border-border bg-surface p-6 shadow-sm sm:p-8"
      noValidate
    >
      {/* The honeypot. Hidden from people and from screen readers, left empty
          by both; a bot that fills every input it finds trips it. Not
          `display:none`, which some bots skip: off-screen with the tab order
          removed is what keeps it invisible to a person and present in the
          DOM for a script. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Do not fill this in</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Your name</Label>
          <input id="name" name="name" className={field} maxLength={LIMITS.name} autoComplete="name" required placeholder="Ana Belmonte" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <input id="email" name="email" type="email" className={field} maxLength={LIMITS.email} autoComplete="email" required placeholder="ana@yourstudio.com" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="company" optional>Studio</Label>
          <input id="company" name="company" className={field} maxLength={LIMITS.company} autoComplete="organization" placeholder="Northline" />
        </div>
        <div>
          <Label htmlFor="topic">What is it about</Label>
          <select id="topic" name="topic" className={field} defaultValue={CONTACT_TOPICS[0]}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <Label htmlFor="message">Your message</Label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          maxLength={LIMITS.message}
          onChange={(e) => setCount(e.currentTarget.value.length)}
          className={`${field} resize-y`}
          placeholder="What are you working on, and what is getting in the way?"
        />
        {/* Only appears near the ceiling. A counter from zero is noise on a
            limit nobody is going to reach. */}
        {count > LIMITS.message * 0.8 && (
          <p className="mt-1.5 text-right text-[12px] font-medium text-text-faint">
            {LIMITS.message - count} characters left
          </p>
        )}
      </div>

      {err && (
        <p
          role="alert"
          className="mt-4 rounded-[11px] px-3.5 py-2.5 text-[14px] font-medium"
          style={{ backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }}
        >
          {err.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-pill bg-accent px-6 py-3 text-[15px] font-bold text-accent-fg transition hover:brightness-110 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "Sending..." : "Send message"}
      </button>

      <p className="mt-4 text-[13px] leading-relaxed text-text-faint">
        We reply within a working day. Your details are used to answer you and
        nothing else: no list, no sequence.
      </p>
    </form>
  );
}
