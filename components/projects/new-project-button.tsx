"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createProject, type FormState } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";

type ClientOption = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create project"}
    </Button>
  );
}

export function NewProjectButton({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<FormState, FormData>(
    createProject,
    null
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New project
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <form action={action} className="space-y-4">
          <Field label="Project title" htmlFor="title">
            <Input
              id="title"
              name="title"
              placeholder="e.g. Bolt Energy: Hero film"
              autoFocus
              required
            />
          </Field>
          <Field label="Client" htmlFor="client_id">
            <Select id="client_id" name="client_id" defaultValue="">
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
                  {PROJECT_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shoot date" htmlFor="shoot_date">
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Submit />
          </div>
        </form>
      </Modal>
    </>
  );
}
