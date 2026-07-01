"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addVersion, type ActionState } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading..." : "Add version"}
    </Button>
  );
}

export function AddVersionForm({
  assetId,
  onDone,
}: {
  assetId: string;
  onDone: () => void;
}) {
  const bound = addVersion.bind(null, assetId);
  const [state, action] = useFormState<ActionState, FormData>(bound, null);
  const [submitted, setSubmitted] = useState(false);

  // Close the modal once a submit completes without error.
  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      onDone();
    }
  }, [submitted, state, onDone]);

  return (
    <form
      action={async (fd) => {
        setSubmitted(true);
        await action(fd);
      }}
      className="space-y-4"
    >
      <Field label="File" htmlFor="file" hint="Upload the new cut, board, or image.">
        <Input id="file" name="file" type="file" />
      </Field>
      <Field label="Or paste a link" htmlFor="url">
        <Input id="url" name="url" type="url" placeholder="https://..." />
      </Field>
      <Field label="Version notes" htmlFor="notes">
        <Textarea id="notes" name="notes" placeholder="What changed in this version?" className="min-h-[72px]" />
      </Field>
      {state?.error && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Submit />
      </div>
    </form>
  );
}
