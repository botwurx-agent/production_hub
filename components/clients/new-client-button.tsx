"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createClient, type FormState } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create client"}
    </Button>
  );
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<FormState, FormData>(createClient, null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New client
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New client">
        <form action={action} className="space-y-4">
          <Field label="Client name" htmlFor="name">
            <Input
              id="name"
              name="name"
              placeholder="e.g. Meridian Agency"
              autoFocus
              required
            />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue="brand">
              <option value="brand">Brand</option>
              <option value="agency">Agency</option>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="Anything worth remembering about this client"
              className="min-h-[72px]"
            />
          </Field>
          {state?.error && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
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
