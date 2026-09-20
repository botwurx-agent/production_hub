"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { renameStudio } from "@/app/(app)/settings/studio-actions";

/**
 * The studio name, editable in place.
 *
 * READ-ONLY UNTIL YOU ASK, because this card is a summary of who you are
 * signed in as and most visits are not here to rename anything. Pressing Edit
 * swaps the line for an input, which keeps the card quiet while still making
 * the capability visible: a non-admin sees the name and a plain sentence
 * saying who can change it, never a control that refuses.
 */
export function StudioName({
  name,
  canEdit,
}: {
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The server is the source of truth: after a save the prop comes back
  // changed, and if the save failed it comes back as it was.
  useEffect(() => setValue(name), [name]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function cancel() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  function save() {
    const next = value.replace(/\s+/g, " ").trim();
    if (!next || next === name) {
      cancel();
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("name", next);
    start(async () => {
      const res = await renameStudio(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      toast(`Studio renamed to ${next}`);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div>
        <dt className="text-xs font-semibold text-text-faint">Name</dt>
        <dd className="mt-0.5 flex items-center gap-2">
          <span className="text-sm font-medium text-text">{name}</span>
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-accent transition hover:underline"
            >
              Edit
            </button>
          )}
        </dd>
        {!canEdit && (
          <p className="mt-1 text-xs text-text-faint">
            Studio admins can change this.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-semibold text-text-faint">Name</dt>
      <dd className="mt-1">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={value}
            maxLength={80}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              // Escape cancels here rather than bubbling, so the rename is
              // abandoned without also closing anything around it.
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            disabled={busy}
            aria-label="Studio name"
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none transition focus:border-accent"
          />
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="secondary" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-text-faint">
          Shown on call sheets, shared documents and the emails you send.
        </p>
        {error && (
          <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}
      </dd>
    </div>
  );
}
