"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  saveLibraryEntry,
  deleteLibraryEntry,
} from "@/app/(app)/projects/[id]/pipeline-actions";
import type { AiPromptLibraryEntry } from "@/lib/database.types";

// Prompt / style library. Two kinds:
//   - prompt: a full reusable prompt you drop into a shot's working prompt.
//   - style : a look fragment (e.g. "35mm film, warm tungsten, shallow DOF")
//     appended to prompts so a whole project shares one look.
// An entry is studio-wide (reusable across projects) or scoped to this project.

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

type Kind = "prompt" | "style";
type Stage = "image" | "video";

function KindPill({ kind }: { kind: string }) {
  const style =
    kind === "style"
      ? { background: "var(--h-purple-bg)", color: "var(--h-purple)" }
      : { background: "var(--h-blue-bg)", color: "var(--h-blue)" };
  return (
    <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide" style={style}>
      {kind === "style" ? "Style" : "Prompt"}
    </span>
  );
}

// ---- Editor (add / edit) ----------------------------------------------------

function EntryEditor({
  projectId,
  initial,
  defaults,
  onSaved,
  onCancel,
}: {
  projectId: string;
  initial?: AiPromptLibraryEntry | null;
  defaults?: { kind?: Kind; body?: string; stage?: Stage | null };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>((initial?.kind as Kind) ?? defaults?.kind ?? "prompt");
  const [name, setName] = useState(initial?.name ?? "");
  const [body, setBody] = useState(initial?.body ?? defaults?.body ?? "");
  const [stage, setStage] = useState<string>(initial?.stage ?? defaults?.stage ?? "");
  const [model, setModel] = useState(initial?.target_model ?? "");
  const [scope, setScope] = useState<"studio" | "project">(
    initial ? (initial.project_id ? "project" : "studio") : "project",
  );

  function save() {
    setErr(null);
    start(async () => {
      const res = await saveLibraryEntry(projectId, {
        id: initial?.id ?? null,
        kind,
        name,
        body,
        stage: (stage || null) as Stage | null,
        target_model: model || null,
        scope,
      });
      if (res?.error) { setErr(res.error); return; }
      onSaved();
    });
  }

  return (
    <div className="space-y-3 rounded-[12px] border border-border bg-surface-2/40 p-3">
      <div className="flex flex-wrap gap-2">
        {(["prompt", "style"] as Kind[]).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className="rounded-[8px] px-3 py-1.5 text-xs font-bold transition"
            style={kind === k
              ? { background: k === "style" ? "var(--h-purple)" : "var(--h-blue)", color: "#fff" }
              : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {k === "style" ? "Style look" : "Full prompt"}
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)}
        placeholder={kind === "style" ? "Name this look (e.g. House film look)" : "Name this prompt (e.g. Hero product spin)"}
        className={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={kind === "style" ? 3 : 5}
        placeholder={kind === "style"
          ? "The look fragment appended to prompts: 35mm film, warm tungsten, shallow depth of field, subtle grain…"
          : "The full reusable prompt…"}
        className={`${field} font-mono text-xs`} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={`mt-1 ${field}`}>
            <option value="">Either</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="any" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as "studio" | "project")} className={`mt-1 ${field}`}>
            <option value="project">This project</option>
            <option value="studio">Whole studio</option>
          </select>
        </div>
      </div>
      {err && <p className="text-xs font-semibold text-red">{err}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={busy || !body.trim()}>{busy ? "Saving…" : initial ? "Save" : "Add to library"}</Button>
      </div>
    </div>
  );
}

// ---- Row --------------------------------------------------------------------

function EntryRow({
  projectId, entry, onEdit,
}: {
  projectId: string; entry: AiPromptLibraryEntry; onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindPill kind={entry.kind} />
          <span className="text-sm font-bold text-text">{entry.name || "Untitled"}</span>
          {entry.stage && <span className="text-[10px] font-semibold uppercase text-text-faint">{entry.stage}</span>}
          <span className="rounded-[5px] bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold text-text-muted">
            {entry.project_id ? "Project" : "Studio"}
          </span>
          {entry.target_model && <span className="text-[10px] text-text-faint">{entry.target_model}</span>}
        </div>
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-text-muted">{entry.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onEdit} className="rounded-[7px] px-2 py-1 text-[11px] font-semibold text-text-muted hover:text-text">Edit</button>
        <button onClick={() => start(async () => { await deleteLibraryEntry(projectId, entry.id); router.refresh(); })}
          disabled={busy} className="rounded-[7px] px-2 py-1 text-[11px] font-semibold text-text-faint hover:text-red">Delete</button>
      </div>
    </div>
  );
}

// ---- Manager modal (full CRUD) ---------------------------------------------

function ManagerModal({
  projectId, entries, onClose,
}: {
  projectId: string; entries: AiPromptLibraryEntry[]; onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AiPromptLibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);

  const styles = entries.filter((e) => e.kind === "style");
  const prompts = entries.filter((e) => e.kind !== "style");
  const done = () => { setEditing(null); setAdding(false); router.refresh(); };

  return (
    <Modal open onClose={onClose} size="lg" title="Prompt & style library">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Reusable prompts and <b className="text-text">style looks</b>. Apply a style look to each
          shot&apos;s prompt to keep one consistent look across the whole job; drop in a saved prompt
          instead of retyping it. Studio entries follow you across every project.
        </p>

        {adding ? (
          <EntryEditor projectId={projectId} onSaved={done} onCancel={() => setAdding(false)} />
        ) : editing ? (
          <EntryEditor projectId={projectId} initial={editing} onSaved={done} onCancel={() => setEditing(null)} />
        ) : (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAdding(true)}>+ New entry</Button>
          </div>
        )}

        {styles.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Style looks</p>
            <div className="space-y-2">
              {styles.map((e) => <EntryRow key={e.id} projectId={projectId} entry={e} onEdit={() => { setAdding(false); setEditing(e); }} />)}
            </div>
          </div>
        )}
        {prompts.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Prompts</p>
            <div className="space-y-2">
              {prompts.map((e) => <EntryRow key={e.id} projectId={projectId} entry={e} onEdit={() => { setAdding(false); setEditing(e); }} />)}
            </div>
          </div>
        )}
        {entries.length === 0 && !adding && (
          <p className="rounded-[10px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
            Nothing saved yet. Add your first style look or prompt.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---- Public: top-control button --------------------------------------------

export function LibraryButton({
  projectId, entries,
}: {
  projectId: string; entries: AiPromptLibraryEntry[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[11px] border border-border px-3 py-2 text-sm font-bold text-text hover:border-border-strong">
        <span className="grid h-6 w-6 place-items-center rounded-[7px]" style={{ background: "var(--h-purple-bg)", color: "var(--h-purple)" }}>❧</span>
        Library <span className="text-xs font-normal text-text-faint">{entries.length || ""}</span>
      </button>
      {open && <ManagerModal projectId={projectId} entries={entries} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---- Public: in-context bar (StagePanel) -----------------------------------

export function LibraryBar({
  projectId, stage, entries, currentPrompt, onInsert, onAppend,
}: {
  projectId: string;
  stage: Stage;
  entries: AiPromptLibraryEntry[];
  currentPrompt: string;
  onInsert: (text: string) => void; // replace the working prompt
  onAppend: (text: string) => void; // append a style look
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pickPrompt, setPickPrompt] = useState(false);

  // Entries usable in this stage (stage null = either).
  const relevant = useMemo(
    () => entries.filter((e) => !e.stage || e.stage === stage),
    [entries, stage],
  );
  const styles = relevant.filter((e) => e.kind === "style");
  const prompts = relevant.filter((e) => e.kind !== "style");

  if (relevant.length === 0 && !saving) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-faint">
        <span>No saved prompts/looks for this stage.</span>
        <button onClick={() => setSaving(true)} className="font-semibold text-accent hover:underline" disabled={!currentPrompt.trim()}>
          Save current →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {styles.map((e) => {
          const applied = currentPrompt.includes(e.body);
          return (
            <button key={e.id} onClick={() => !applied && onAppend(e.body)} disabled={applied}
              title={e.body}
              className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-bold transition"
              style={applied
                ? { background: "var(--h-purple)", color: "#fff" }
                : { background: "var(--h-purple-bg)", color: "var(--h-purple)" }}>
              {applied ? "✓" : "＋"} {e.name || "Style"}
            </button>
          );
        })}
        {prompts.length > 0 && (
          <div className="relative">
            <button onClick={() => setPickPrompt((v) => !v)}
              className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-[11px] font-bold text-text-muted hover:text-text">
              Use a saved prompt ▾
            </button>
            {pickPrompt && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPickPrompt(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-[10px] border border-border bg-surface p-1 shadow-lg">
                  {prompts.map((e) => (
                    <button key={e.id} onClick={() => { onInsert(e.body); setPickPrompt(false); }}
                      className="block w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-surface-2">
                      <div className="text-xs font-bold text-text">{e.name || "Untitled"}</div>
                      <div className="line-clamp-1 text-[11px] text-text-faint">{e.body}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button onClick={() => setSaving(true)} disabled={!currentPrompt.trim()}
          className="ml-auto text-[11px] font-semibold text-accent hover:underline disabled:text-text-faint disabled:no-underline">
          Save current →
        </button>
      </div>
      {saving && (
        <EntryEditor projectId={projectId}
          defaults={{ kind: "prompt", body: currentPrompt, stage }}
          onSaved={() => { setSaving(false); router.refresh(); }}
          onCancel={() => setSaving(false)} />
      )}
    </div>
  );
}
