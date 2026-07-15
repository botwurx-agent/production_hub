"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createProject, type FormState } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import {
  PROJECT_TYPES,
  projectType,
  stageLabel,
  hasShootDay,
  type ProjectTypeKey,
} from "@/lib/project-types";

type ClientOption = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create project"}
    </Button>
  );
}

export function NewProjectButton({
  clients,
  defaultClientId = "",
  label = "New project",
  variant = "primary",
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProjectTypeKey | null>(null);
  const [state, action] = useFormState<FormState, FormData>(createProject, null);

  function close() {
    setOpen(false);
    // Reset the wizard for next time (after the modal has faded).
    setTimeout(() => setType(null), 150);
  }

  const chosen = type ? projectType(type) : null;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={type ? "New project · details" : "What kind of project?"}
      >
        {!type ? (
          // Step 1: pick a type.
          <div>
            <p className="mb-4 text-sm text-text-muted">
              This tailors the workspace to the job. You can use every tool on any
              project either way.
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className="flex items-start gap-3 rounded-[14px] border border-border bg-surface p-3.5 text-left transition hover:border-border-strong hover:shadow-sm"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
                    style={{ backgroundColor: `var(--h-${t.hue}-bg)`, color: `var(--h-${t.hue})` }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={t.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold text-text">
                      {t.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-text-muted">
                      {t.blurb}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Step 2: details.
          <form action={action} className="space-y-4">
            <input type="hidden" name="project_type" value={type} />

            <button
              type="button"
              onClick={() => setType(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {chosen?.label}
              <span className="font-normal text-text-faint">· change</span>
            </button>

            <Field label="Project title" htmlFor="title">
              <Input
                id="title"
                name="title"
                placeholder="e.g. IQ Bar: Hero product film"
                autoFocus
                required
              />
            </Field>
            <Field label="Client" htmlFor="client_id">
              <Select id="client_id" name="client_id" defaultValue={defaultClientId}>
                <option value="">No client yet</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage" htmlFor="status">
              <Select id="status" name="status" defaultValue="pre_pro">
                {PROJECT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s, type)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={hasShootDay(type) ? "Shoot date" : "Target date"}
                htmlFor="shoot_date"
              >
                <Input id="shoot_date" name="shoot_date" type="date" />
              </Field>
              <Field label="Due date" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>
            {state?.error && (
              <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                {state.error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Submit />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
