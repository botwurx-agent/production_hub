"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  WARDROBE_FIELDS,
  WARDROBE_GROUPS,
  wantsRepresentation,
  wantsWardrobe,
  type Wardrobe,
} from "@/lib/talent";
import type { ProfileInput } from "@/app/(app)/projects/[id]/talent-actions";
import {
  addContactFile,
  deleteContactFile,
  getContactFileUrl,
  uploadHeadshot,
} from "@/app/(app)/projects/[id]/talent-actions";
import type { ContactFile } from "@/lib/talent-data";

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 flex items-baseline gap-2 text-xs font-bold uppercase tracking-wide text-text-faint">
        {label}
        {hint ? <span className="font-medium normal-case tracking-normal">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="font-display text-sm font-bold text-text">{title}</h4>
        {note ? <p className="mt-0.5 text-xs text-text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The profile form: representation, catering and wardrobe.
 *
 * Controlled by the parent modal rather than saving on its own, because a
 * contact and its profile are one person to the user and two rows only to the
 * database. Two Save buttons in one window would make our schema their problem.
 *
 * WHAT SHOWS DEPENDS ON THE CATEGORY. Dietary is asked of everyone, because
 * crew eat too and this is what feeds the meal round. Wardrobe and
 * representation are asked only of talent and extras: a gaffer's inseam is not
 * the studio's business, and a form that asks for it reads as a company
 * collecting whatever it can rather than what it needs.
 */
export function ProfilePane({
  category,
  value,
  onChange,
}: {
  category: string;
  value: ProfileInput;
  onChange: (patch: Partial<ProfileInput>) => void;
}) {
  const wardrobe: Wardrobe = value.wardrobe ?? {};
  const setSize = (key: string, v: string) =>
    onChange({ wardrobe: { ...wardrobe, [key]: v } });

  const showRep = wantsRepresentation(category);
  const showWardrobe = wantsWardrobe(category);

  return (
    <div className="space-y-6">
      {showRep && (
        <Group title="Billing and representation">
          <div className="flex gap-3">
            <Field label="Credited as" hint="if different" className="flex-1">
              <input
                value={value.creditedAs ?? ""}
                onChange={(e) => onChange({ creditedAs: e.target.value })}
                placeholder="Stage name"
                className={inputCls}
              />
            </Field>
            <Field label="Pronouns" className="w-32">
              <input
                value={value.pronouns ?? ""}
                onChange={(e) => onChange({ pronouns: e.target.value })}
                placeholder="they/them"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex gap-3">
            <Field label="Union" className="flex-1">
              <input
                value={value.unionStatus ?? ""}
                onChange={(e) => onChange({ unionStatus: e.target.value })}
                placeholder="SAG-AFTRA, non-union…"
                className={inputCls}
              />
            </Field>
            <Field label="Website" className="flex-1">
              <input
                value={value.website ?? ""}
                onChange={(e) => onChange({ website: e.target.value })}
                placeholder="reel or portfolio"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Agent or manager">
            <input
              value={value.agentName ?? ""}
              onChange={(e) => onChange({ agentName: e.target.value })}
              placeholder="Name and agency"
              className={inputCls}
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Agent email" className="flex-1">
              <input
                value={value.agentEmail ?? ""}
                onChange={(e) => onChange({ agentEmail: e.target.value })}
                placeholder="agent@agency.com"
                className={inputCls}
              />
            </Field>
            <Field label="Agent phone" className="flex-1">
              <input
                value={value.agentPhone ?? ""}
                onChange={(e) => onChange({ agentPhone: e.target.value })}
                placeholder="(555) 123-4567"
                className={inputCls}
              />
            </Field>
          </div>
        </Group>
      )}

      <Group
        title="Catering"
        note="Goes out with the meal order for this shoot. Crew with access to this project can see it."
      >
        <Field label="Allergies">
          <input
            value={value.allergies ?? ""}
            onChange={(e) => onChange({ allergies: e.target.value })}
            placeholder="Peanuts, shellfish…"
            className={inputCls}
          />
        </Field>
        <Field label="Dietary restrictions">
          <input
            value={value.dietaryRestrictions ?? ""}
            onChange={(e) => onChange({ dietaryRestrictions: e.target.value })}
            placeholder="Vegetarian, low-carb, halal…"
            className={inputCls}
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={value.dietaryNotes ?? ""}
            onChange={(e) => onChange({ dietaryNotes: e.target.value })}
            placeholder="Needs to eat on a schedule, no nuts in the room…"
            className={`${inputCls} min-h-[54px]`}
          />
        </Field>
      </Group>

      {showWardrobe && (
        <Group title="Wardrobe" note="Only what you have. Blank fields are simply not shown.">
          {WARDROBE_GROUPS.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {g.label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {WARDROBE_FIELDS.filter((f) => f.group === g.key).map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-[11px] font-semibold text-text-muted">
                      {f.label}
                    </label>
                    <input
                      value={wardrobe[f.key] ?? ""}
                      onChange={(e) => setSize(f.key, e.target.value)}
                      placeholder={f.hint}
                      className={`${inputCls} px-2 py-1.5 text-[13px]`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

function fileSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Headshot, paperwork and reference for one person.
 *
 * Reachable only once the contact exists, because a file has to hang off an id.
 * The parent hides this tab entirely while adding rather than showing it
 * disabled, since "save this first" is a rule about our storage, not a step in
 * the user's task.
 */
export function FilesPane({
  projectId,
  contactId,
  headshotUrl,
  files,
}: {
  projectId: string;
  contactId: string;
  headshotUrl: string | null;
  files: ContactFile[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const headshotRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Copy the FileList to an array BEFORE clearing the input. A FileList is a
  // live view of the input's selection, so reading it inside a later closure
  // returns nothing. Recorded in CLAUDE.md after it silently broke email
  // attachments; the same trap applies to every file input.
  function pick(input: HTMLInputElement | null): File | null {
    const list = input?.files;
    const file = list && list.length ? list[0] : null;
    if (input) input.value = "";
    return file;
  }

  function sendHeadshot() {
    const file = pick(headshotRef.current);
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadHeadshot(projectId, contactId, fd);
      if (res?.error) return toast(res.error);
      router.refresh();
      toast("Headshot updated");
    });
  }

  function sendFile() {
    const file = pick(fileRef.current);
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await addContactFile(projectId, contactId, fd);
      if (res?.error) return toast(res.error);
      router.refresh();
      toast("File added");
    });
  }

  async function open(id: string) {
    setOpening(id);
    const url = await getContactFileUrl(id);
    setOpening(null);
    if (url) window.open(url, "_blank", "noopener");
    else toast("Could not open that file.");
  }

  const media = files.filter((f) => f.kind === "media");
  const docs = files.filter((f) => f.kind !== "media");

  return (
    <div className="space-y-6">
      <Group title="Headshot">
        <div className="flex items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-text-faint">
            {headshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headshotUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
              </svg>
            )}
          </span>
          <div>
            <input
              ref={headshotRef}
              type="file"
              accept="image/*"
              hidden
              onChange={sendHeadshot}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => headshotRef.current?.click()}
            >
              {headshotUrl ? "Replace" : "Upload"}
            </Button>
            <p className="mt-1.5 text-xs text-text-faint">
              Shows on the roster card and the call sheet.
            </p>
          </div>
        </div>
      </Group>

      <Group
        title="Files"
        note="Release forms, W-9s, size sheets, fitting photos. Images and video go to Media, everything else to Documents."
      >
        <input ref={fileRef} type="file" hidden onChange={sendFile} />
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          + Add a file
        </Button>

        {files.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-3 py-6 text-center text-xs text-text-faint">
            Nothing filed against this person yet.
          </p>
        ) : (
          <div className="space-y-4">
            {[
              { label: "Documents", rows: docs },
              { label: "Media", rows: media },
            ]
              .filter((s) => s.rows.length > 0)
              .map((s) => (
                <div key={s.label}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                    {s.label} <span className="text-text-faint">{s.rows.length}</span>
                  </p>
                  <ul className="divide-y divide-border rounded-[10px] border border-border">
                    {s.rows.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                        <button
                          onClick={() => open(f.id)}
                          className="min-w-0 flex-1 text-left text-[13px] font-medium text-text transition hover:text-accent"
                        >
                          <span className="block truncate">{f.name}</span>
                        </button>
                        <span className="shrink-0 text-[11px] text-text-faint">
                          {opening === f.id ? "Opening…" : fileSize(f.size_bytes)}
                        </span>
                        <button
                          onClick={() =>
                            start(async () => {
                              const res = await deleteContactFile(projectId, f.id);
                              if (res?.error) return toast(res.error);
                              router.refresh();
                            })
                          }
                          disabled={busy}
                          className="shrink-0 text-text-faint transition hover:text-red disabled:opacity-40"
                          aria-label={`Delete ${f.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </Group>
    </div>
  );
}
