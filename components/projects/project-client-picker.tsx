"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProject } from "@/app/(app)/projects/actions";
import { toast } from "@/components/ui/toast";

// Inline editor for a project's linked Client (the brand/agency it bills to).
// The client can only otherwise be set at project creation; this lets you set
// or change it later, which invoicing needs.
export function ProjectClientPicker({
  projectId,
  clientId,
  clientName,
  clients,
}: {
  projectId: string;
  clientId: string | null;
  clientName: string | null;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();

  function choose(id: string) {
    start(async () => {
      const res = await updateProject(projectId, { client_id: id || null });
      if (res?.error) {
        toast(res.error, "error");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <select
          autoFocus
          defaultValue={clientId ?? ""}
          disabled={busy}
          onChange={(e) => choose(e.target.value)}
          className="rounded-[8px] border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-border-strong"
        >
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {clients.length === 0 && (
          <a href="/clients" className="text-xs font-semibold text-accent underline">
            Add a client
          </a>
        )}
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-text-faint transition hover:text-text"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-sm text-text-muted transition hover:bg-surface-2 hover:text-text"
      title="Set the client this project bills to"
    >
      {clientName ?? "Set client"}
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}
