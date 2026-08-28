"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";
import {
  PROP_CATEGORIES,
  PROP_STATUS,
  PROP_STATUS_ORDER,
  groupByCategory,
  pickedOption,
  propStatus,
  summarizeProps,
  type Prop,
  type PropOption,
} from "@/lib/props";
import {
  addProp,
  addPropOptionFile,
  addPropOptionLink,
  deleteProp,
  deletePropOption,
  pickPropOption,
  setPropStatus,
  updateProp,
  type PropInput,
} from "@/app/(app)/projects/[id]/prop-actions";

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

/** Signed thumbnail URLs, keyed by option id, resolved on the server. */
export type OptionUrls = Record<string, string>;

export function PropsWorkspace({
  projectId,
  props: rows,
  optionUrls,
  vendors,
}: {
  projectId: string;
  props: Prop[];
  optionUrls: OptionUrls;
  vendors: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<Prop | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const sum = summarizeProps(rows);
  const groups = groupByCategory(rows);

  if (rows.length === 0) {
    return (
      <>
        <div className="rounded-[16px] border border-dashed border-border py-14 text-center">
          <div
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[14px]"
            style={{ backgroundColor: "var(--h-pink-bg)", color: "var(--h-pink)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
              <path d="M3 8.5v7L12 20l9-4.5v-7" />
              <path d="M12 13v7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">No props yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
            The glassware, linens, furnishings and hand props this job needs.
            Gather options against each one, pick the winner, and send the lot to
            the client for approval.
          </p>
          <div className="mt-5">
            <Button onClick={() => setAdding(true)}>+ Add a prop</Button>
          </div>
        </div>
        {adding && (
          <PropModal
            projectId={projectId}
            prop={null}
            vendors={vendors}
            onClose={() => setAdding(false)}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {/* Where the list stands. `undecided` is the one worth its own tile: it
          is the pile waiting on somebody else's decision. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tally label="Props" value={sum.total} />
        <Tally label="Still needed" value={sum.needed} hue="red" />
        <Tally label="Awaiting a pick" value={sum.undecided} hue="amber" />
        <Tally label="Booked or on set" value={sum.settled} hue="green" />
        <span className="flex-1" />
        <Button onClick={() => setAdding(true)}>+ Add a prop</Button>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.category}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
              {g.category}
              <span className="ml-1.5 font-semibold text-text-faint">{g.items.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((p) => (
                <PropCard
                  key={p.id}
                  projectId={projectId}
                  prop={p}
                  optionUrls={optionUrls}
                  expanded={open === p.id}
                  onToggle={() => setOpen(open === p.id ? null : p.id)}
                  onEdit={() => setEditing(p)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {(adding || editing) && (
        <PropModal
          projectId={projectId}
          prop={editing}
          vendors={vendors}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Tally({ label, value, hue }: { label: string; value: number; hue?: string }) {
  const dim = value === 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-sm"
      style={
        hue && !dim
          ? { backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})`, borderColor: "transparent" }
          : undefined
      }
    >
      <span className="font-bold">{value}</span>
      <span className={dim ? "text-text-faint" : "font-medium"}>{label}</span>
    </span>
  );
}

function StatusChip({
  projectId,
  prop,
}: {
  projectId: string;
  prop: Prop;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const s = propStatus(prop.status);
  const meta = PROP_STATUS[s];

  // Click to advance, wrapping at the end. Same interaction as a cost's status
  // chip, so there is one thing to learn rather than two.
  function advance() {
    const i = PROP_STATUS_ORDER.indexOf(s);
    const next = PROP_STATUS_ORDER[(i + 1) % PROP_STATUS_ORDER.length];
    start(async () => {
      const res = await setPropStatus(projectId, prop.id, next);
      if (res?.error) return toast(res.error);
      router.refresh();
    });
  }

  return (
    <button
      onClick={advance}
      disabled={busy}
      title="Click to advance"
      className="rounded-pill px-2 py-0.5 text-[11px] font-bold transition disabled:opacity-50"
      style={{ backgroundColor: `var(--h-${meta.hue}-bg)`, color: `var(--h-${meta.hue})` }}
    >
      {meta.label}
    </button>
  );
}

function PropCard({
  projectId,
  prop,
  optionUrls,
  expanded,
  onToggle,
  onEdit,
}: {
  projectId: string;
  prop: Prop;
  optionUrls: OptionUrls;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const picked = pickedOption(prop);
  const hero = picked ?? prop.options[0] ?? null;
  const heroUrl = hero ? optionUrls[hero.id] : undefined;

  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <button
        onClick={onToggle}
        className="grid aspect-[4/3] w-full place-items-center overflow-hidden bg-surface-2 text-text-faint"
      >
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs">
            {prop.options.length ? "No photo" : "No options yet"}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text">{prop.name}</p>
            <p className="truncate text-xs text-text-muted">
              {prop.qty > 1 ? `${prop.qty} needed` : "1 needed"}
              {prop.source ? ` · ${prop.source}` : ""}
            </p>
          </div>
          <button
            onClick={onEdit}
            className="shrink-0 text-text-faint transition hover:text-text"
            aria-label={`Edit ${prop.name}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip projectId={projectId} prop={prop} />
          {prop.options.length > 0 && (
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              {prop.options.length} option{prop.options.length === 1 ? "" : "s"}
            </span>
          )}
          {/* Says WHICH one, not just that there is one: on a card showing a
              photo, "picked" without a name leaves you guessing which. */}
          {picked ? (
            <span
              className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }}
            >
              Picked{picked.name ? `: ${picked.name}` : ""}
            </span>
          ) : prop.options.length > 0 ? (
            <span
              className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
            >
              No pick yet
            </span>
          ) : null}
        </div>

        {prop.notes && !expanded && (
          <p className="mt-2 line-clamp-2 text-[13px] text-text-muted">{prop.notes}</p>
        )}

        <button
          onClick={onToggle}
          className="mt-3 self-start text-xs font-semibold text-accent hover:underline"
        >
          {expanded ? "Hide options" : `Options (${prop.options.length})`}
        </button>

        {expanded && (
          <OptionsPanel
            projectId={projectId}
            prop={prop}
            optionUrls={optionUrls}
          />
        )}
      </div>
    </div>
  );
}

function OptionsPanel({
  projectId,
  prop,
  optionUrls,
}: {
  projectId: string;
  prop: Prop;
  optionUrls: OptionUrls;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [optName, setOptName] = useState("");

  function upload() {
    // Copy the FileList BEFORE clearing the input: it is a live view of the
    // selection, so reading it later returns nothing. Recorded in CLAUDE.md.
    const list = fileRef.current?.files;
    const files = list ? Array.from(list) : [];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;

    start(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await addPropOptionFile(projectId, prop.id, fd);
        if (res?.error) {
          toast(res.error);
          break;
        }
      }
      router.refresh();
    });
  }

  function addLink() {
    if (!url.trim()) return;
    start(async () => {
      const res = await addPropOptionLink(projectId, prop.id, {
        url,
        name: optName || null,
      });
      if (res?.error) return toast(res.error);
      setUrl("");
      setOptName("");
      setLinking(false);
      router.refresh();
    });
  }

  function pick(o: PropOption) {
    const next = prop.picked_option_id === o.id ? null : o.id;
    start(async () => {
      const res = await pickPropOption(projectId, prop.id, next);
      if (res?.error) return toast(res.error);
      router.refresh();
    });
  }

  async function removeOption(o: PropOption) {
    const ok = await confirmAction({
      title: "Remove this option?",
      body:
        prop.picked_option_id === o.id
          ? "It is the picked option, so this prop goes back to undecided."
          : "The photo is deleted with it.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deletePropOption(projectId, o.id);
      if (res?.error) return toast(res.error);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {prop.options.length === 0 ? (
        <p className="text-xs text-text-faint">
          Add the options you are choosing between.
        </p>
      ) : (
        <ul className="space-y-2">
          {prop.options.map((o, i) => {
            const isPick = prop.picked_option_id === o.id;
            const thumb = optionUrls[o.id];
            return (
              <li
                key={o.id}
                className="flex items-center gap-2.5 rounded-[10px] border p-1.5"
                style={{
                  borderColor: isPick ? "var(--h-green)" : "var(--border)",
                  backgroundColor: isPick ? "var(--h-green-bg)" : "transparent",
                }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[7px] bg-surface-2 text-[10px] text-text-faint">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    `#${i + 1}`
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">
                    {o.name || `Option ${i + 1}`}
                  </p>
                  {o.url && (
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-[11px] text-accent hover:underline"
                    >
                      Open source
                    </a>
                  )}
                </div>
                <button
                  onClick={() => pick(o)}
                  disabled={busy}
                  className="shrink-0 rounded-pill px-2 py-1 text-[11px] font-bold transition disabled:opacity-50"
                  style={
                    isPick
                      ? { backgroundColor: "var(--h-green)", color: "#fff" }
                      : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }
                  }
                >
                  {isPick ? "Picked" : "Pick"}
                </button>
                <button
                  onClick={() => removeOption(o)}
                  disabled={busy}
                  className="shrink-0 text-text-faint transition hover:text-red disabled:opacity-40"
                  aria-label="Remove option"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          + Photos
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setLinking((v) => !v)}>
          + Link
        </Button>
      </div>

      {linking && (
        <div className="mt-2 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://prophouse.example/item/123"
            className={`${inputCls} text-[13px]`}
          />
          <input
            value={optName}
            onChange={(e) => setOptName(e.target.value)}
            placeholder="Name it (optional)"
            className={`${inputCls} text-[13px]`}
          />
          <Button size="sm" onClick={addLink} disabled={busy || !url.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

function PropModal({
  projectId,
  prop,
  vendors,
  onClose,
}: {
  projectId: string;
  prop: Prop | null;
  vendors: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PropInput>({
    name: prop?.name ?? "",
    category: prop?.category ?? "",
    qty: prop?.qty ?? 1,
    notes: prop?.notes ?? "",
    source: prop?.source ?? "",
    contactId: prop?.contact_id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = <K extends keyof PropInput>(k: K, v: PropInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Photos and links staged in the modal become the prop's OPTIONS on save.
  // The card's Options panel could always do this, but the moment somebody
  // has the picture in hand is while they are creating the prop, and a window
  // with no way to attach it reads as "images not supported". Same
  // discoverability lesson as the export cover panel.
  const stageFileRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<
    { file: File; preview: string }[]
  >([]);
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState("");

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    // Copy the FileList BEFORE clearing the input: it is a live view.
    const list = e.target.files;
    const files = list ? Array.from(list) : [];
    e.target.value = "";
    const ok: { file: File; preview: string }[] = [];
    for (const f of files) {
      if (f.size > MAX_UPLOAD_BYTES) {
        toast(
          `${f.name} is ${formatBytes(f.size)}, over the ${formatBytes(
            MAX_UPLOAD_BYTES
          )} limit for an upload.`,
          "error"
        );
        continue;
      }
      ok.push({ file: f, preview: URL.createObjectURL(f) });
    }
    if (ok.length) setPendingFiles((p) => [...p, ...ok]);
  }

  function removePendingFile(i: number) {
    setPendingFiles((p) => {
      URL.revokeObjectURL(p[i]?.preview ?? "");
      return p.filter((_, j) => j !== i);
    });
  }

  function stageLink() {
    const u = linkUrl.trim();
    if (!u) return;
    setPendingLinks((p) => [...p, u]);
    setLinkUrl("");
  }

  function clearStaged() {
    pendingFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setPendingFiles([]);
    setPendingLinks([]);
    setLinkUrl("");
  }

  /** Returns the first failure, or null; the prop itself is already saved. */
  async function applyStaged(propId: string): Promise<string | null> {
    for (const { file } of pendingFiles) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await addPropOptionFile(projectId, propId, fd);
      if (res?.error) return res.error;
    }
    for (const url of pendingLinks) {
      const res = await addPropOptionLink(projectId, propId, { url });
      if (res?.error) return res.error;
    }
    return null;
  }

  function save(again: boolean) {
    if (!form.name.trim()) return setError("Give the prop a name.");
    setError(null);
    start(async () => {
      const res = prop
        ? await updateProp(projectId, prop.id, form)
        : await addProp(projectId, form);
      if (res?.error) return setError(res.error);
      const propId = prop ? prop.id : res?.id;
      if (propId && (pendingFiles.length || pendingLinks.length)) {
        const optErr = await applyStaged(propId);
        // The prop saved; a failed option is named rather than failing the lot.
        if (optErr) toast(optErr, "error");
      }
      clearStaged();
      router.refresh();
      if (again && !prop) {
        // Keep the category, which is almost always the same for a run of
        // props being entered together.
        setForm((f) => ({ ...f, name: "", qty: 1, notes: "", source: "" }));
      } else onClose();
    });
  }

  async function remove() {
    if (!prop) return;
    const ok = await confirmAction({
      title: `Delete ${prop.name}?`,
      body:
        prop.options.length > 0
          ? `Its ${prop.options.length} option${prop.options.length === 1 ? "" : "s"} and their photos go too.`
          : "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteProp(projectId, prop.id);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={prop ? "Edit prop" : "Add a prop"} size="md">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
              Prop
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Hero glassware"
              autoFocus
              className={inputCls}
            />
          </div>
          <div className="w-24">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
              Qty
            </label>
            <input
              type="number"
              min={1}
              value={form.qty ?? 1}
              onChange={(e) => set("qty", Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
            Category
          </label>
          <input
            list="prop-categories"
            value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Glassware"
            className={inputCls}
          />
          {/* A datalist, not a select: the list is a shortcut for the common
              case, and every art department names things a little differently. */}
          <datalist id="prop-categories">
            {PROP_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
              Source
            </label>
            <input
              value={form.source ?? ""}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Prop house, shop, own stock"
              className={inputCls}
            />
          </div>
          {vendors.length > 0 && (
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
                Vendor
              </label>
              <select
                value={form.contactId ?? ""}
                onChange={(e) => set("contactId", e.target.value)}
                className={inputCls}
              >
                <option value="">Not linked</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
            Notes
          </label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Must be unbranded. Needs to hold 12oz without looking oversized."
            className={`${inputCls} min-h-[60px]`}
          />
        </div>

        {/* Photos and links, staged here, saved as the prop's options. */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-text-faint">
            Photos &amp; links
          </label>

          {(pendingFiles.length > 0 || pendingLinks.length > 0) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((f, i) => (
                <span
                  key={f.preview}
                  className="relative h-14 w-14 overflow-hidden rounded-[9px] border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removePendingFile(i)}
                    className="absolute right-0.5 top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-black/60 text-white"
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {pendingLinks.map((u, i) => (
                <span
                  key={`${u}-${i}`}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-muted"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  <span className="truncate">{u.replace(/^https?:\/\//, "")}</span>
                  <button
                    onClick={() =>
                      setPendingLinks((p) => p.filter((_, j) => j !== i))
                    }
                    className="shrink-0 text-text-faint hover:text-red"
                    aria-label="Remove link"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => stageFileRef.current?.click()}
            >
              + Photos
            </Button>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  stageLink();
                }
              }}
              placeholder="Paste a link (prop house, shop)"
              className={`${inputCls} min-w-0 flex-1 text-[13px]`}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !linkUrl.trim()}
              onClick={stageLink}
            >
              Add
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-text-faint">
            Saved as this prop&apos;s options, ready to compare and pick from.
          </p>
          <input
            ref={stageFileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={pickFiles}
          />
        </div>

        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          {prop ? (
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
            {!prop && (
              <Button variant="secondary" onClick={() => save(true)} disabled={busy}>
                Save &amp; add another
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
