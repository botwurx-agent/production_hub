"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createAsset, type ActionState } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { ASSET_TYPE_LABEL } from "@/lib/status";

const TYPES = ["image", "video", "storyboard", "reference", "cut", "other"];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add asset"}
    </Button>
  );
}

export function AddAssetButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const bound = createAsset.bind(null, projectId);
  const [state, action] = useFormState<ActionState, FormData>(bound, null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      setOpen(false);
    }
  }, [submitted, state]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <PlusIcon /> Add asset
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add asset">
        <form
          action={async (fd) => {
            setSubmitted(true);
            await action(fd);
          }}
          className="space-y-4"
        >
          <Field label="Asset name" htmlFor="name">
            <Input
              id="name"
              name="name"
              placeholder="e.g. Hero cut, Storyboards, Pack shots"
              autoFocus
              required
            />
          </Field>
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue="other">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="First version file"
            htmlFor="file"
            hint="Optional. You can add versions later."
          >
            <Input id="file" name="file" type="file" />
          </Field>
          <Field label="Or paste a link" htmlFor="url">
            <Input id="url" name="url" type="url" placeholder="https://..." />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="Notes for this first version"
              className="min-h-[64px]"
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
