"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import {
  MAX_REQUEST_FILE_BYTES,
  REQUEST_LIMITS,
  type RequestFields,
} from "@/lib/job-request";
import type { submitJobRequest, finishJobRequest } from "@/app/request/[token]/actions";

type Submit = typeof submitJobRequest;
type Finish = typeof finishJobRequest;

function mb(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")}MB`;
  return `${Math.max(1, Math.round(bytes / 1000))}KB`;
}

/**
 * The client's side of a job request. Actions are passed in rather than
 * imported, so a fixture can mount the real form without a database.
 */
export function RequestForm({
  token,
  studioName,
  todayIso,
  submit,
  finish,
}: {
  token: string;
  studioName: string;
  todayIso: string;
  submit: Submit;
  finish: Finish;
}) {
  const startedAt = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ field?: RequestFields; text: string } | null>(null);
  const [done, setDone] = useState<{ title: string; missed: string[] } | null>(null);

  function pick(list: FileList | null) {
    // Copy BEFORE clearing the input: a FileList is a live view of the
    // selection and resetting the input empties it.
    const picked = list ? Array.from(list) : [];
    if (fileInput.current) fileInput.current.value = "";
    if (!picked.length) return;
    const tooBig = picked.find((f) => f.size > MAX_REQUEST_FILE_BYTES);
    if (tooBig) {
      setError({ field: "files", text: `"${tooBig.name}" is over ${mb(MAX_REQUEST_FILE_BYTES)}. Share a link to it in the details instead.` });
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...picked].slice(0, REQUEST_LIMITS.files));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setError(null);
    setBusy("Sending your request...");
    try {
      const res = await submit(token, {
        title: get("title"),
        details: get("details"),
        neededBy: get("neededBy"),
        budget: get("budget"),
        name: get("name"),
        email: get("email"),
        website: get("website"),
        startedAt: startedAt.current,
        files: files.map((x) => ({ name: x.name, size: x.size, type: x.type })),
      });
      if (!res) {
        setError({ text: "That did not reach the studio. Check your connection and try again." });
        return;
      }
      if (!res.ok) {
        setError({ field: res.field, text: res.error });
        return;
      }

      // The request exists now. Files go straight to storage, one at a time,
      // and any that fail are named rather than failing the request.
      const missed: string[] = [];
      const sent: { path: string; name: string }[] = [];
      const supabase = createClient();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const up = res.uploads.find((u) => u.index === i);
        if (!up) {
          missed.push(file.name);
          continue;
        }
        setBusy(`Uploading ${file.name} (${i + 1} of ${files.length})...`);
        const { error: upErr } = await supabase.storage
          .from("assets")
          .uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || undefined });
        if (upErr) missed.push(file.name);
        else sent.push({ path: up.path, name: file.name });
      }
      if (sent.length && res.requestId) {
        setBusy("Attaching your files...");
        const fin = await finish(token, res.requestId, sent);
        if (!fin || !fin.ok) missed.push(...sent.map((s) => s.name));
        else if (fin.saved < sent.length) {
          // Anything the server could not confirm is reported as missing.
          const n = sent.length - fin.saved;
          if (n > 0) missed.push(`${n} ${n === 1 ? "file" : "files"}`);
        }
      }
      setDone({ title: get("title").trim(), missed });
    } catch {
      setError({ text: "That did not reach the studio. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-[16px] border border-border bg-surface p-6 sm:p-8" data-request-done>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--h-green)" }}
          >
            ✓
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-text">Request sent</h2>
            <p className="mt-1 text-[15px] text-text-muted">
              {studioName} has your request{done.title ? ` for "${done.title}"` : ""} and
              will reply by email.
            </p>
            {done.missed.length > 0 && (
              <p className="mt-3 rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm text-text">
                <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--h-amber)" }} />
                These did not upload, so send them by email: {done.missed.join(", ")}.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setFiles([]);
                startedAt.current = Date.now();
              }}
              className="mt-4 text-sm font-semibold text-accent hover:underline"
            >
              Send another request
            </button>
          </div>
        </div>
      </div>
    );
  }

  const err = (field: RequestFields) =>
    error?.field === field ? (
      <p className="text-xs font-medium text-text" data-field-error={field}>
        <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: "var(--h-red)" }} />
        {error.text}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="relative space-y-5 rounded-[16px] border border-border bg-surface p-5 sm:p-7" noValidate>
      <Field label="What do you need?" htmlFor="rq-title">
        <Input id="rq-title" name="title" maxLength={REQUEST_LIMITS.title} placeholder="Three 15s cutdowns of the summer spot" required />
        {err("title")}
      </Field>
      <Field label="Details" htmlFor="rq-details" hint="Deliverables, formats, where it will run, references. Or attach a brief below.">
        <Textarea id="rq-details" name="details" maxLength={REQUEST_LIMITS.details} rows={6} />
        {err("details")}
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Needed by" htmlFor="rq-date" hint="Optional">
          <Input id="rq-date" name="neededBy" type="date" min={todayIso} />
          {err("neededBy")}
        </Field>
        <Field label="Budget" htmlFor="rq-budget" hint="Optional, in USD">
          <Input id="rq-budget" name="budget" inputMode="decimal" placeholder="12,500" />
          {err("budget")}
        </Field>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-text-muted">Files</span>
        <div className="rounded-[11px] border border-dashed border-border-strong bg-surface-2 px-3 py-3">
          {files.length > 0 && (
            <ul className="mb-2 space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-text">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-text-faint">{mb(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-xs font-semibold text-text-muted hover:text-text"
                      aria-label={`Remove ${f.name}`}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {files.length < REQUEST_LIMITS.files ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-sm font-semibold text-accent hover:underline"
            >
              {files.length ? "Add another file" : "Attach a brief, references or a script"}
            </button>
          ) : (
            <p className="text-xs text-text-faint">That is the most one request can carry.</p>
          )}
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
        </div>
        <p className="text-xs text-text-faint">
          Up to {REQUEST_LIMITS.files} files, {mb(MAX_REQUEST_FILE_BYTES)} each. For anything bigger, paste a link in the details.
        </p>
        {err("files")}
      </div>

      <div className="grid grid-cols-1 gap-5 border-t border-border pt-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="rq-name">
          <Input id="rq-name" name="name" maxLength={REQUEST_LIMITS.name} autoComplete="name" required />
          {err("name")}
        </Field>
        <Field label="Your email" htmlFor="rq-email" hint="Where the studio replies">
          <Input id="rq-email" name="email" type="email" maxLength={REQUEST_LIMITS.email} autoComplete="email" required />
          {err("email")}
        </Field>
      </div>

      {/* The honeypot: off-canvas, unreachable by keyboard, left empty by people. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="rq-website">Do not fill this in</label>
        <input id="rq-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && !error.field && (
        <p className="rounded-[11px] border border-border bg-surface-2 px-3 py-2 text-sm text-text">
          <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--h-red)" }} />
          {error.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={Boolean(busy)} data-request-submit>
          {busy ? "Sending..." : `Send to ${studioName}`}
        </Button>
        {busy && <span className="text-sm text-text-muted" aria-live="polite">{busy}</span>}
      </div>
    </form>
  );
}
