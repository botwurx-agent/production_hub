"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createLead, type FormState } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { LEAD_STAGE, LEAD_STAGE_ORDER } from "@/lib/status";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add lead"}
    </Button>
  );
}

export function NewLeadButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<FormState, FormData>(createLead, null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      setOpen(false);
    }
  }, [submitted, state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New lead
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New lead">
        <form
          action={async (fd) => {
            setSubmitted(true);
            await action(fd);
          }}
          className="space-y-4"
        >
          <Field label="Company" htmlFor="company">
            <Input
              id="company"
              name="company"
              placeholder="e.g. IQ Bar"
              autoFocus
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" htmlFor="contact_name">
              <Input
                id="contact_name"
                name="contact_name"
                placeholder="e.g. Jane Doe"
              />
            </Field>
            <Field label="Title" htmlFor="contact_title">
              <Input
                id="contact_title"
                name="contact_title"
                placeholder="e.g. Brand Manager"
              />
            </Field>
          </div>
          <Field label="Email" htmlFor="contact_email">
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="e.g. jane@iqbar.com"
            />
          </Field>
          <Field label="Source" htmlFor="source">
            <Input
              id="source"
              name="source"
              placeholder="e.g. Referral, Instagram, past client"
            />
          </Field>
          <Field label="Stage" htmlFor="stage">
            <Select id="stage" name="stage" defaultValue="new">
              {LEAD_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STAGE[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="What's the opportunity?"
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
