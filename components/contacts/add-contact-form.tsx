"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormState = { error?: string } | null;
type BoundAction = (prev: FormState, formData: FormData) => Promise<FormState>;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add contact"}
    </Button>
  );
}

/**
 * Shared add-contact form. The parent binds the target (client or lead) into
 * the action, so this component works for both stakeholders lists.
 */
export function AddContactForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useFormState<FormState, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) ref.current?.reset();
  }, [state]);

  return (
    <form
      ref={ref}
      action={formAction}
      className="rounded-[12px] border border-dashed border-border p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input name="name" placeholder="Name" required />
        <Input name="role" placeholder="Role (e.g. Creative Director)" />
        <Input name="email" type="email" placeholder="Email" />
        <Input name="phone" placeholder="Phone" />
      </div>
      {state?.error && (
        <p className="mt-2 text-xs font-medium text-red">{state.error}</p>
      )}
      <div className="mt-2 flex justify-end">
        <Submit />
      </div>
    </form>
  );
}
