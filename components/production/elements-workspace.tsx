"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  HANDLE_PLATFORMS,
  PICKABLE_KINDS,
  suggestedHandle,
  displayHandle,
  kindMeta,
  type CastReference,
  type CastShot,
  type CastUse,
  type RefKind,
} from "@/lib/cast";
import {
  addSheet,
  addSheetFromLink,
  archiveReference,
  deleteHandle,
  deleteSheet,
  saveHandle,
  saveReference,
} from "@/app/(app)/projects/[id]/cast-actions";
import { uploadAssetFile } from "@/components/projects/upload-file";

const field =
  "w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

const KIND_ICONS: Record<RefKind, ReactNode> = {
  auto: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="16" cy="16" r="3" />
      <circle cx="7" cy="17" r="2" />
    </svg>
  ),
  character: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  element: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  ),
  location: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  crowd: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

/**
 * The references for a job: the images a generation is built from, and the
 * handles the platform gave them.
 *
 * One flat list on purpose. This page used to model characters, the looks that
 * dressed them and the elements those looks were composed of, which was true to
 * the domain and made adding one wardrobe a six-step errand across two screens.
 * A reference is what the platform actually stores.
 *
 * Which shots use which reference is set in the PIPELINE, on the shot, where
 * you are already working. The map at the bottom of this page is a read-only
 * view of that.
 */
export function ElementsWorkspace({
  projectId,
  studioId,
  references,
  shots,
  uses,
}: {
  projectId: string;
  studioId: string;
  references: CastReference[];
  shots: CastShot[];
  uses: CastUse[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CastReference | "new" | null>(null);
  const [newKind, setNewKind] = useState<RefKind>("auto");
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Resolved by id out of current server data rather than held as a snapshot,
  // so the modal can stay open across the first save and a freshly uploaded
  // image appears without a close-reopen.
  const subject = useMemo(() => {
    if (!editing) return null;
    const id = editing === "new" ? createdId : editing.id;
    if (!id) return null;
    return references.find((r) => r.id === id) ?? (editing === "new" ? null : editing);
  }, [editing, createdId, references]);

  function close() {
    setEditing(null);
    setCreatedId(null);
  }

  const modal = editing && (
    <ReferenceModal
      projectId={projectId}
      studioId={studioId}
      reference={subject}
      defaultKind={newKind}
      onCreated={(id) => {
        setCreatedId(id);
        router.refresh();
      }}
      onClose={close}
      onGone={() => {
        close();
        router.refresh();
      }}
    />
  );

  if (references.length === 0) {
    return (
      <>
        <Card className="p-6">
          <EmptyState
            hue="purple"
            title="No elements yet"
            description="A saved, named image you can call by handle in any prompt: a character, wardrobe, a prop, a place. The same thing Higgsfield calls an element."
            steps={[
              {
                title: "Add an element",
                text: "Its image, and the handle the platform gave it.",
              },
              {
                title: "Use it on a shot",
                text: "Pick which elements a shot uses, in the pipeline.",
              },
              {
                title: "Write the prompt",
                text: "Its handles sit above the prompt, one click to insert.",
              },
            ]}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                {PICKABLE_KINDS.map((k) => (
                  <KindTile
                    key={k.key}
                    kind={k}
                    onClick={() => {
                      setNewKind(k.key);
                      setEditing("new");
                    }}
                  />
                ))}
              </div>
            }
          />
        </Card>
        {modal}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-sm font-bold">Elements</h2>
          <span className="text-xs text-text-faint">
            {references.length} in this job
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {PICKABLE_KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => {
                  setNewKind(k.key);
                  setEditing("new");
                }}
                className="rounded-[9px] border border-border-strong px-2.5 py-1 text-xs font-semibold transition hover:border-accent hover:text-accent"
              >
                + {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {references.map((r) => (
            <ReferenceCard key={r.id} reference={r} onOpen={() => setEditing(r)} />
          ))}
        </div>
      </Card>

      <UsageMap references={references} shots={shots} uses={uses} />

      {modal}
    </div>
  );
}

function KindTile({
  kind,
  onClick,
}: {
  kind: (typeof PICKABLE_KINDS)[number];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ borderTop: `3px solid var(--h-${kind.hue})` }}
      className="flex w-[176px] flex-col rounded-[14px] border border-border-strong bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <IconTile hue={kind.hue}>{KIND_ICONS[kind.key]}</IconTile>
      <span className="mt-3 font-display text-[15px] font-bold tracking-[-0.2px]">
        {kind.label}
      </span>
      <span className="mt-1 text-[11.5px] leading-snug text-text-faint">
        {kind.hint}
      </span>
      <span className="mt-auto flex items-center gap-1 pt-3 font-display text-[12px] font-bold text-accent">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add
      </span>
    </button>
  );
}

function ReferenceCard({
  reference,
  onOpen,
}: {
  reference: CastReference;
  onOpen: () => void;
}) {
  const meta = kindMeta(reference.kind);
  const cover = reference.sheets[0];
  return (
    <button
      onClick={onOpen}
      style={{ borderTop: `3px solid var(--h-${meta.hue})` }}
      className="flex flex-col overflow-hidden rounded-[13px] border border-border bg-surface text-left transition hover:border-accent hover:shadow-md"
    >
      <span className="block aspect-[4/3] w-full bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[11.5px] text-text-faint">
            No image yet
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col p-3">
        <span className="truncate font-display text-[13.5px] font-bold">
          {reference.name}
        </span>
        <span className="mt-0.5 text-[11px] text-text-faint">{meta.label}</span>
        <span className="mt-2 flex flex-wrap gap-1">
          {reference.handles.length > 0 ? (
            reference.handles.map((h) => (
              <span
                key={h.id}
                className="rounded-pill bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] text-accent"
              >
                {displayHandle(h.handle)}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-text-faint">No handle yet</span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * Read-only. Where each reference is used, across the sequence.
 *
 * It stopped being an editor deliberately: the question "which references does
 * this shot use" belongs next to the prompt you are about to write, not on a
 * separate page you have to remember to visit first.
 */
function UsageMap({
  references,
  shots,
  uses,
}: {
  references: CastReference[];
  shots: CastShot[];
  uses: CastUse[];
}) {
  if (shots.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="font-display text-sm font-bold">Where they are used</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          Add shots in the pipeline and they will appear here.
        </p>
      </Card>
    );
  }

  const used = new Set(uses.map((u) => `${u.shot_id}:${u.entity_id}`));

  return (
    <Card className="p-4">
      <h2 className="font-display text-sm font-bold">Where they are used</h2>
      <p className="mb-3 mt-0.5 text-[12px] text-text-faint">
        Set on the shot, in the pipeline. This is the overview.
      </p>
      <div className="overflow-x-auto rounded-[13px] border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[190px] border-b border-r border-border bg-surface-2 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-faint">
                Element
              </th>
              {shots.map((s, i) => (
                <th
                  key={s.id}
                  className="min-w-[110px] border-b border-border bg-surface-2 px-3 py-2.5 text-left"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                    Shot {i + 1}
                  </span>
                  <span className="block truncate text-[12.5px] font-semibold">
                    {s.title || "Untitled"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {references.map((r) => {
              const meta = kindMeta(r.kind);
              return (
                <tr key={r.id}>
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-2 text-left">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--h-${meta.hue})` }}
                      />
                      <span className="truncate text-[13px] font-medium">
                        {r.name}
                      </span>
                    </span>
                  </th>
                  {shots.map((s) => {
                    const on = used.has(`${s.id}:${r.id}`);
                    return (
                      <td
                        key={s.id}
                        className="border-b border-border px-3 py-2 text-center"
                      >
                        {on ? (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: `var(--h-${meta.hue})` }}
                            title="Used in this shot"
                          />
                        ) : (
                          <span className="text-text-faint">&middot;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ the one modal --

function ReferenceModal({
  projectId,
  studioId,
  reference,
  defaultKind,
  onCreated,
  onClose,
  onGone,
}: {
  projectId: string;
  studioId: string;
  reference: CastReference | null;
  defaultKind: RefKind;
  onCreated: (id: string) => void;
  onClose: () => void;
  onGone: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<RefKind>(reference?.kind ?? defaultKind);
  const [name, setName] = useState(reference?.name ?? "");
  const [description, setDescription] = useState(reference?.description ?? "");
  const [prompt, setPrompt] = useState(reference?.prompt ?? "");
  const [notes, setNotes] = useState(reference?.notes ?? "");
  const [studioWide, setStudioWide] = useState(
    reference ? reference.project_id === null : false
  );
  const [platform, setPlatform] = useState(HANDLE_PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, start] = useTransition();

  // Higgsfield derives an element's @name from the name you type in its own
  // dialog. Naming the thing the same in both places is the sane way to work,
  // so the handle follows the name until the operator overrides it. Saves the
  // step entirely in the common case, and the platform stays the authority
  // because the field is still editable.
  const effectiveHandle = handleTouched ? handle : suggestedHandle(name);

  function submit() {
    const creating = !reference;
    start(async () => {
      const res = await saveReference(projectId, reference?.id ?? null, {
        kind,
        name,
        description,
        prompt,
        notes,
        studioWide,
      });
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      if (creating && "id" in res && res.id) {
        // Record the handle in the same breath as the create, so the common
        // path is one action rather than save-then-remember.
        if (effectiveHandle.trim()) {
          const h = await saveHandle(projectId, res.id, platform, effectiveHandle);
          if ("error" in h && h.error) toast(h.error, "error");
        }
        setJustSaved(true);
        onCreated(res.id);
        return;
      }
      onGone();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={reference ? reference.name : "New element"}
      size="xl"
    >
      {/* Laid out like Higgsfield's own New Element dialog: the details on the
          left, the media on the right. Same shape and same words in both
          places means nothing to translate when flipping between them. */}
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${field} text-[15px] font-semibold`}
            placeholder="Enter name"
            autoFocus={!reference}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={field}
            placeholder="Add description"
          />

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-text-muted">Category</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as RefKind)}
              className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            >
              {PICKABLE_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[11px] border border-border bg-surface-2 p-3">
            <p className="mb-1 text-xs font-semibold text-text-muted">
              Handle on the platform
            </p>
            <p className="mb-2.5 text-[11.5px] text-text-faint">
              What a prompt calls this. It follows the name above, which is what
              Higgsfield does too. Change it if the platform named it something
              else: a prompt only resolves on an exact match.
            </p>

            {reference && reference.handles.length > 0 && (
              <ul className="mb-2.5 grid gap-1">
                {reference.handles.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-text-faint">{h.platform}</span>
                    <span className="font-mono text-accent">
                      {displayHandle(h.handle)}
                    </span>
                    <button
                      onClick={() =>
                        start(async () => {
                          const res = await deleteHandle(projectId, h.id);
                          if (res?.error) toast(res.error, "error");
                          else router.refresh();
                        })
                      }
                      disabled={busy}
                      className="ml-auto rounded-[7px] border border-border px-1.5 py-0.5 text-[11px] font-semibold text-text-muted transition hover:border-red hover:text-red"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-[10px] border border-border bg-surface px-2 py-2 text-[13px] outline-none focus:border-accent"
              >
                {HANDLE_PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                value={effectiveHandle}
                onChange={(e) => {
                  setHandleTouched(true);
                  setHandle(e.target.value);
                }}
                className={`${field} font-mono text-[13px]`}
                placeholder="Maya"
              />
              {reference && (
                <Button
                  variant="secondary"
                  disabled={busy || !effectiveHandle.trim()}
                  onClick={() =>
                    start(async () => {
                      const res = await saveHandle(
                        projectId,
                        reference.id,
                        platform,
                        effectiveHandle
                      );
                      if ("error" in res && res.error) toast(res.error, "error");
                      else {
                        setHandle("");
                        setHandleTouched(false);
                        router.refresh();
                      }
                    })
                  }
                >
                  Add
                </Button>
              )}
            </div>
          </div>

          <details className="rounded-[11px] border border-border px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-text-muted">
              Prompt and notes
            </summary>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-text-muted">
                  Prompt
                  {prompt.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(prompt)
                          .then(() => toast("Prompt copied.", "success"))
                          .catch(() => toast("Could not copy.", "error"));
                      }}
                      className="rounded-[7px] border border-border px-1.5 py-0.5 text-[11px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
                    >
                      Copy
                    </button>
                  )}
                </span>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className={field}
                  placeholder="The prompt that generates this one, so it is not rewritten from memory next time."
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-muted">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={field}
                />
              </label>
              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={studioWide}
                  onChange={(e) => setStudioWide(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Keep across projects
                  <span className="block text-[11.5px] text-text-faint">
                    For a mascot or spokesperson who comes back on the next job.
                  </span>
                </span>
              </label>
            </div>
          </details>
        </div>

        <div className="flex flex-col">
          {reference ? (
            <SheetStrip
              projectId={projectId}
              studioId={studioId}
              refId={reference.id}
              sheets={reference.sheets}
            />
          ) : (
            <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-[13px] border-2 border-dashed border-border bg-surface-2 p-6 text-center">
              <span className="mb-2 grid h-10 w-10 place-items-center rounded-full border border-border-strong text-lg text-text-faint">
                +
              </span>
              <span className="font-display text-sm font-bold text-text-muted">
                Upload media
              </span>
              <span className="mt-1 text-[11.5px] text-text-faint">
                Save first and this opens. A file has to belong to something.
              </span>
            </div>
          )}
        </div>
      </div>

      {justSaved && (
        <p className="mt-4 rounded-[10px] bg-green-bg px-3 py-2 text-[12.5px] text-green">
          Saved{effectiveHandle.trim() ? ` as @${suggestedHandle(effectiveHandle)}` : ""}.
          Drop its image in on the right, then close.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          onClick={submit}
          disabled={busy || !name.trim() || (justSaved && !reference)}
        >
          {busy
            ? "Saving..."
            : justSaved && !reference
              ? "Saved"
              : reference
                ? "Save changes"
                : "Create"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {reference ? "Close" : "Cancel"}
        </Button>
        {reference && (
          <Button
            variant="danger"
            className="ml-auto"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await archiveReference(projectId, reference.id);
                if (res?.error) toast(res.error, "error");
                else onGone();
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </Modal>
  );
}


function SheetStrip({
  projectId,
  studioId,
  refId,
  sheets,
}: {
  projectId: string;
  studioId: string;
  refId: string;
  sheets: { id: string; url: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const [over, setOver] = useState(false);
  const [, start] = useTransition();

  async function pick(files: FileList | null) {
    // Copy the FileList to an array BEFORE the input is cleared: a FileList is
    // a live view of the input's selection, so reading it later reads nothing.
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy(true);
    try {
      for (const file of list) {
        const up = await uploadAssetFile({ studioId, projectId, file });
        const res = await addSheet(projectId, refId, up.storagePath);
        if (res?.error) {
          toast(res.error, "error");
          break;
        }
      }
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    try {
      const res = await addSheetFromLink(projectId, refId, value);
      if (res?.error) {
        toast(res.error, "error");
        return;
      }
      setUrl("");
      setLinking(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      // Drag and drop, because that is how the platform's own dialog takes a
      // file and because dragging a render straight out of a folder is the
      // whole interaction here.
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void pick(e.dataTransfer.files);
      }}
      className={`rounded-[13px] border-2 border-dashed p-3 transition ${
        over ? "border-accent bg-accent-soft" : "border-border bg-surface-2"
      }`}
    >
      <p className="mb-2 text-xs font-semibold text-text-muted">Image</p>
      {sheets.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {sheets.map((sh) => (
            <span key={sh.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sh.url}
                alt=""
                className="h-20 w-32 rounded-[9px] border border-border object-cover"
              />
              <button
                onClick={() =>
                  start(async () => {
                    const res = await deleteSheet(projectId, sh.id);
                    if (res?.error) toast(res.error, "error");
                    else router.refresh();
                  })
                }
                className="absolute right-1 top-1 rounded-[6px] bg-surface px-1.5 text-xs font-bold opacity-50 shadow-sm transition hover:opacity-100"
                aria-label="Remove this image"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-accent">
          {busy ? "Working..." : sheets.length ? "Add another" : "Upload media"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() => setLinking((v) => !v)}
          className="rounded-[10px] border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-accent"
        >
          {linking ? "Cancel" : "Paste a link"}
        </button>
      </div>

      {!sheets.length && !linking && (
        <p className="mt-2 text-[11.5px] text-text-faint">
          Drag and drop, or click to upload.
        </p>
      )}

      {linking && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addLink();
            }}
            className={`${field} max-w-[420px] flex-1 text-[13px]`}
            placeholder="Share page or direct image link"
            autoFocus
          />
          <Button
            variant="secondary"
            disabled={busy || !url.trim()}
            onClick={() => void addLink()}
          >
            {busy ? "Fetching..." : "Add"}
          </Button>
        </div>
      )}
    </div>
  );
}
