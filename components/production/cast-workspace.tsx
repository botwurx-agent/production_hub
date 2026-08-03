"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ContinuityGrid } from "@/components/production/continuity-grid";
import {
  ENTITY_KINDS,
  HANDLE_PLATFORMS,
  castWarnings,
  displayHandle,
  kindMeta,
  looksSceneBound,
  slugify,
  type CastAssignment,
  type CastEntity,
  type CastLook,
  type CastSheet,
  type CastShot,
  type EntityKind,
} from "@/lib/cast";
import {
  addSheet,
  archiveEntity,
  deleteHandle,
  deleteLook,
  deleteSheet,
  saveEntity,
  saveHandle,
  saveLook,
} from "@/app/(app)/projects/[id]/cast-actions";
import { uploadAssetFile } from "@/components/projects/upload-file";

const field =
  "w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";

export function CastWorkspace({
  projectId,
  studioId,
  entities,
  shots,
  assignments,
}: {
  projectId: string;
  studioId: string;
  entities: CastEntity[];
  shots: CastShot[];
  assignments: CastAssignment[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CastEntity | "new" | null>(null);
  const [newKind, setNewKind] = useState<EntityKind>("character");
  const [lookFor, setLookFor] = useState<{ entity: CastEntity; look: CastLook | null } | null>(null);
  const [platform, setPlatform] = useState(HANDLE_PLATFORMS[0]);

  const warnings = useMemo(
    () => castWarnings(entities, shots, assignments, platform),
    [entities, shots, assignments, platform]
  );

  // Which cells to tint amber in the grid.
  const changedShotIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const w of warnings) {
      if (w.kind !== "look-change") continue;
      const set = m.get(w.entityId) ?? new Set<string>();
      set.add(w.shotId);
      m.set(w.entityId, set);
    }
    return m;
  }, [warnings]);

  const noSheet = warnings.filter((w) => w.kind === "no-sheet");
  const noHandle = warnings.filter((w) => w.kind === "no-handle");
  const noLook = warnings.filter((w) => w.kind === "no-look");
  const changes = warnings.filter((w) => w.kind === "look-change");
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? "Something";

  if (entities.length === 0) {
    return (
      <>
        <Card className="p-6">
          <EmptyState
            hue="purple"
            title="No cast yet"
            description="Characters, wardrobe, props, locations and extras for this job, with the handles that make a prompt resolve the same way every time."
            steps={[
              {
                title: "Add the cast",
                text: "A character, the garments as elements, the location.",
              },
              {
                title: "Group a look",
                text: "A tee and a ring become one look she wears.",
              },
              {
                title: "Assign to shots",
                text: "The continuity grid fills in and starts checking.",
              },
            ]}
            action={
              // All four kinds are doors, not just the character. A single
              // "Add a character" button hid the other three behind a chip row
              // you could only find by opening the modal, so the page read as
              // character-only until you had already committed to something.
              <div className="flex flex-wrap justify-center gap-2">
                {ENTITY_KINDS.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => { setNewKind(k.key); setEditing("new"); }}
                    className="w-[168px] rounded-[12px] border border-border bg-surface p-3 text-left transition hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="mb-1 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: `var(--h-${k.hue})` }}
                      />
                      <span className="font-display text-[13px] font-bold">
                        {k.label}
                      </span>
                    </span>
                    <span className="block text-[11.5px] leading-snug text-text-faint">
                      {k.hint}
                    </span>
                  </button>
                ))}
              </div>
            }
          />
        </Card>
        {editing && (
          <EntityModal
            projectId={projectId}
            studioId={studioId}
            entity={editing === "new" ? null : editing}
            defaultKind={newKind}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); router.refresh(); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ what needs fixing */}
      {(noSheet.length || noHandle.length || noLook.length || changes.length) > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-sm font-bold">Worth a look</h2>
            <label className="ml-auto flex items-center gap-2 text-xs text-text-muted">
              Generating on
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-[9px] border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              >
                {HANDLE_PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <ul className="grid gap-2 text-[13px]">
            {noHandle.map((w, i) => (
              <li key={`h${i}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
                <span>
                  <strong className="font-medium">{nameOf(w.entityId)}</strong> has no{" "}
                  {platform} handle, so a prompt will describe it in words and the
                  look will drift.
                </span>
              </li>
            ))}
            {noSheet.map((w, i) => (
              <li key={`s${i}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>
                  <strong className="font-medium">{nameOf(w.entityId)}</strong> has no
                  reference sheet.
                </span>
              </li>
            ))}
            {noLook.map((w, i) => (
              <li key={`l${i}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>
                  <strong className="font-medium">{nameOf(w.entityId)}</strong> is in a
                  shot with no look chosen.
                </span>
              </li>
            ))}
            {changes.map((w, i) => (
              <li key={`c${i}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                <span>
                  <strong className="font-medium">{nameOf(w.entityId)}</strong> changes
                  look between shots. Deliberate, or a continuity error?
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --------------------------------------------- the continuity grid */}
      <Card className="p-4">
        <h2 className="mb-3 font-display text-sm font-bold">Continuity</h2>
        <ContinuityGrid
          projectId={projectId}
          entities={entities}
          shots={shots}
          assignments={assignments}
          changedShotIds={changedShotIds}
        />
      </Card>

      {/* --------------------------------------------------- the cast list */}
      {ENTITY_KINDS.map((kind) => {
        const list = entities.filter((e) => e.kind === kind.key);
        return (
          <Card key={kind.key} className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display text-sm font-bold">{kind.plural}</h2>
              <span className="text-xs text-text-faint">{kind.hint}</span>
              <Button
                size="sm"
                variant="secondary"
                className="ml-auto"
                onClick={() => { setNewKind(kind.key); setEditing("new"); }}
              >
                Add
              </Button>
            </div>

            {list.length === 0 ? (
              <p className="text-[13px] text-text-faint">None yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((e) => (
                  <EntityCard
                    key={e.id}
                    projectId={projectId}
                    entity={e}
                    onEdit={() => setEditing(e)}
                    onAddLook={() => setLookFor({ entity: e, look: null })}
                    onEditLook={(l) => setLookFor({ entity: e, look: l })}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {editing && (
        <EntityModal
          projectId={projectId}
          studioId={studioId}
          entity={editing === "new" ? null : editing}
          defaultKind={newKind}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}

      {lookFor && (
        <LookModal
          projectId={projectId}
          studioId={studioId}
          entity={lookFor.entity}
          look={lookFor.look}
          elements={entities.filter((e) => e.kind === "element")}
          onClose={() => setLookFor(null)}
          onSaved={() => { setLookFor(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ sheets --

/**
 * Reference sheets for an entity or a look.
 *
 * The file goes browser -> Storage directly through a server-minted signed URL,
 * the same path asset versions use. Routing a multi-megabyte character sheet
 * through a server action would hit the ~4.5MB request cap and die at the
 * platform edge with nothing we could show.
 */
function SheetStrip({
  projectId,
  studioId,
  owner,
  sheets,
}: {
  projectId: string;
  studioId: string;
  owner: { entityId: string } | { lookId: string };
  sheets: CastSheet[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
        const res = await addSheet(projectId, owner, up.storagePath);
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

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-text-muted">Reference sheets</p>
      {sheets.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {sheets.map((sh) => (
            <span key={sh.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sh.url}
                alt="Reference sheet"
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
                className="absolute right-1 top-1 rounded-[6px] bg-surface px-1.5 text-xs font-bold opacity-0 shadow-sm transition group-hover:opacity-100"
                aria-label="Remove this sheet"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Lineage, when it was recorded: which sheets this render was made from.
          Shown on the newest sheet only, since that is the one in use. */}
      {sheets[0]?.from && sheets[0].from.length > 0 && (
        <p className="mb-2 text-[11px] text-text-faint">
          Made from {sheets[0].from.join(", ")}
        </p>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-accent">
        {busy ? "Uploading..." : sheets.length ? "Add another" : "Upload a sheet"}
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
    </div>
  );
}

// ----------------------------------------------------------------- the card --

function EntityCard({
  projectId,
  entity,
  onEdit,
  onAddLook,
  onEditLook,
}: {
  projectId: string;
  entity: CastEntity;
  onEdit: () => void;
  onAddLook: () => void;
  onEditLook: (look: CastLook) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const meta = kindMeta(entity.kind);

  return (
    <div
      className="overflow-hidden rounded-[13px] border border-border bg-surface"
      style={{ borderTop: `3px solid var(--h-${meta.hue})` }}
    >
      {entity.sheets[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entity.sheets[0].url}
          alt={`${entity.name} reference sheet`}
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="grid h-28 place-items-center bg-surface-2 text-[11px] text-text-faint">
          No sheet yet
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{entity.name}</h3>
            <p className="truncate font-mono text-[11px] text-text-faint">
              {entity.slug}
              {entity.project_id === null && " · studio-wide"}
            </p>
          </div>
          <button
            onClick={onEdit}
            className="rounded-[8px] px-2 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            Edit
          </button>
        </div>

        {entity.handles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entity.handles.map((h) => (
              <span
                key={h.id}
                title={`${h.platform}. Click to remove.`}
                className="group inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-[10.5px] text-accent"
              >
                {displayHandle(h.handle)}
                <button
                  onClick={() =>
                    start(async () => {
                      const res = await deleteHandle(projectId, h.id);
                      if (res?.error) toast(res.error, "error");
                      else router.refresh();
                    })
                  }
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label={`Remove ${h.handle}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Looks only make sense on something that can be dressed or staged. */}
        {entity.kind !== "crowd" && (
          <div className="mt-3 border-t border-border pt-2.5">
            <div className="mb-1.5 flex items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                Looks
              </span>
              <button
                onClick={onAddLook}
                className="ml-auto text-[11px] font-semibold text-accent hover:underline"
              >
                Add
              </button>
            </div>
            {entity.looks.length === 0 ? (
              <p className="text-[11.5px] text-text-faint">None.</p>
            ) : (
              <ul className="grid gap-1">
                {entity.looks.map((l) => (
                  <li key={l.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onEditLook(l)}
                      className="min-w-0 flex-1 truncate text-left text-[12.5px] hover:text-accent"
                    >
                      {l.name}
                      {l.itemIds.length > 0 && (
                        <span className="text-text-faint"> · {l.itemIds.length} items</span>
                      )}
                    </button>
                    {l.handles.map((h) => (
                      <span
                        key={h.id}
                        className="shrink-0 rounded-pill bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent"
                      >
                        {displayHandle(h.handle)}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- entity editing --

function EntityModal({
  projectId,
  studioId,
  entity,
  defaultKind,
  onClose,
  onSaved,
}: {
  projectId: string;
  studioId: string;
  entity: CastEntity | null;
  defaultKind: EntityKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<EntityKind>(entity?.kind ?? defaultKind);
  const [name, setName] = useState(entity?.name ?? "");
  const [slug, setSlug] = useState(entity?.slug ?? "");
  const [description, setDescription] = useState(entity?.description ?? "");
  const [notes, setNotes] = useState(entity?.notes ?? "");
  const [studioWide, setStudioWide] = useState(entity ? entity.project_id === null : false);
  const [platform, setPlatform] = useState(HANDLE_PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  const [busy, start] = useTransition();

  // Auto-derive the slug until it is touched, so nobody has to think about it.
  const effectiveSlug = slug || slugify(name);

  function submit() {
    start(async () => {
      const res = await saveEntity(projectId, entity?.id ?? null, {
        kind,
        name,
        slug: effectiveSlug,
        description,
        notes,
        studioWide,
      });
      if ("error" in res && res.error) toast(res.error, "error");
      else onSaved();
    });
  }

  function addHandle() {
    if (!entity) {
      toast("Save this first, then add its handle.", "info");
      return;
    }
    start(async () => {
      const res = await saveHandle(projectId, { entityId: entity.id }, platform, handle);
      if ("error" in res && res.error) toast(res.error, "error");
      else {
        setHandle("");
        router.refresh();
      }
    });
  }

  return (
    <Modal open onClose={onClose} title={entity ? entity.name : "Add to the cast"} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ENTITY_KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
                kind === k.key
                  ? "text-accent-fg"
                  : "border border-border text-text-muted hover:border-border-strong"
              }`}
              style={kind === k.key ? { backgroundColor: `var(--h-${k.hue})` } : undefined}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-faint">{kindMeta(kind).hint}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Maya" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">
              Reference name
            </span>
            <input
              value={effectiveSlug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${field} font-mono`}
              placeholder="maya"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={field}
            placeholder="Late 20s, dark curly hair, warm olive skin. The words a prompt falls back on when no handle exists."
          />
        </label>

        {entity && (
          <div className="rounded-[11px] border border-border bg-surface-2 p-3">
            <SheetStrip
              projectId={projectId}
              studioId={studioId}
              owner={{ entityId: entity.id }}
              sheets={entity.sheets}
            />
          </div>
        )}

        {kindMeta(kind).needsHandle && (
          <div className="rounded-[11px] border border-border bg-surface-2 p-3">
            <p className="mb-2 text-xs font-semibold text-text-muted">
              Platform handles
            </p>
            <p className="mb-2.5 text-[11.5px] text-text-faint">
              The name the platform gave back when you uploaded this. The prompt only
              resolves if it matches exactly, so paste it rather than retyping it.
            </p>
            {entity?.handles.length ? (
              <ul className="mb-2.5 grid gap-1">
                {entity.handles.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-text-faint">{h.platform}</span>
                    <span className="font-mono text-accent">{displayHandle(h.handle)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-[11px] border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
              >
                {HANDLE_PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className={`${field} font-mono`}
                placeholder="@maya"
              />
              <Button variant="secondary" onClick={addHandle} disabled={busy || !handle.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

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

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-muted">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />
        </label>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {entity && (
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() =>
                start(async () => {
                  const res = await archiveEntity(projectId, entity.id);
                  if (res?.error) toast(res.error, "error");
                  else onSaved();
                })
              }
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ look editing --

function LookModal({
  projectId,
  studioId,
  entity,
  look,
  elements,
  onClose,
  onSaved,
}: {
  projectId: string;
  studioId: string;
  entity: CastEntity;
  look: CastLook | null;
  elements: CastEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(look?.name ?? "");
  const [slug, setSlug] = useState(look?.slug ?? "");
  const [description, setDescription] = useState(look?.description ?? "");
  const [items, setItems] = useState<string[]>(look?.itemIds ?? []);
  const [platform, setPlatform] = useState(HANDLE_PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  const [busy, start] = useTransition();

  const effectiveSlug = slug || slugify(name);
  const sceneBound = looksSceneBound(name);

  return (
    <Modal open onClose={onClose} title={`${entity.name}: ${look ? look.name : "new look"}`} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Denim, day one" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-muted">
              Reference name
            </span>
            <input
              value={effectiveSlug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${field} font-mono`}
              placeholder="wd1"
            />
          </label>
        </div>

        {/* Advisory, not enforced: a studio may have a convention we have not
            thought of, and hard-blocking a name is a bad trade. */}
        {sceneBound && (
          <p className="rounded-[10px] bg-amber-bg px-3 py-2 text-[12.5px] text-amber">
            Naming a look after a scene stops being true the moment the same outfit
            comes back in another one. Consider naming the look itself.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-text-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={field}
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-text-muted">What it is made of</p>
          <p className="mb-2 text-[11.5px] text-text-faint">
            Each garment and accessory is its own element, so the ring can appear in
            three looks and you can still ask which shots it is in.
          </p>
          {elements.length === 0 ? (
            <p className="text-[12.5px] text-text-faint">
              No elements yet. Add the garments as elements first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {elements.map((el) => {
                const on = items.includes(el.id);
                return (
                  <button
                    key={el.id}
                    onClick={() =>
                      setItems((prev) =>
                        on ? prev.filter((i) => i !== el.id) : [...prev, el.id]
                      )
                    }
                    className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? "bg-accent text-accent-fg"
                        : "border border-border text-text-muted hover:border-border-strong"
                    }`}
                  >
                    {el.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {look && (
          <div className="rounded-[11px] border border-border bg-surface-2 p-3">
            <SheetStrip
              projectId={projectId}
              studioId={studioId}
              owner={{ lookId: look.id }}
              sheets={look.sheets}
            />
            <p className="mt-2 text-[11.5px] text-text-faint">
              This is the combined sheet: the character wearing this look, which
              is what you reference when generating the shot.
            </p>
          </div>
        )}

        {look && (
          <div className="rounded-[11px] border border-border bg-surface-2 p-3">
            <p className="mb-2 text-xs font-semibold text-text-muted">
              Handles for this look
            </p>
            <p className="mb-2.5 text-[11.5px] text-text-faint">
              The wardrobe is uploaded separately and comes back with its own name, so
              a look carries its own handle.
            </p>
            {look.handles.length > 0 && (
              <ul className="mb-2.5 grid gap-1">
                {look.handles.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-text-faint">{h.platform}</span>
                    <span className="font-mono text-accent">{displayHandle(h.handle)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="rounded-[11px] border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
              >
                {HANDLE_PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className={`${field} font-mono`}
                placeholder="@maya_wd1"
              />
              <Button
                variant="secondary"
                disabled={busy || !handle.trim()}
                onClick={() =>
                  start(async () => {
                    const res = await saveHandle(projectId, { lookId: look.id }, platform, handle);
                    if ("error" in res && res.error) toast(res.error, "error");
                    else {
                      setHandle("");
                      router.refresh();
                    }
                  })
                }
              >
                Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button
            disabled={busy || !name.trim()}
            onClick={() =>
              start(async () => {
                const res = await saveLook(projectId, entity.id, look?.id ?? null, {
                  name,
                  slug: effectiveSlug,
                  description,
                  itemEntityIds: items,
                });
                if ("error" in res && res.error) toast(res.error, "error");
                else onSaved();
              })
            }
          >
            {busy ? "Saving..." : "Save look"}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {look && (
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() =>
                start(async () => {
                  const res = await deleteLook(projectId, look.id);
                  if (res?.error) toast(res.error, "error");
                  else onSaved();
                })
              }
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
