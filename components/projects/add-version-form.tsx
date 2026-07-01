"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addVersion, type ActionState } from "@/app/(app)/projects/[id]/actions";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";

function Submit({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || busy}>
      {pending || busy ? "Uploading..." : "Add version"}
    </Button>
  );
}

export function AddVersionForm({
  assetId,
  projectId,
  studioId,
  onDone,
}: {
  assetId: string;
  projectId: string;
  studioId: string;
  onDone: () => void;
}) {
  const bound = addVersion.bind(null, assetId);
  const [state, action] = useFormState<ActionState, FormData>(bound, null);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      onDone();
    }
  }, [submitted, state, onDone]);

  return (
    <form
      action={async (fd) => {
        setUploadError(null);
        const file = fd.get("file");
        if (file instanceof File && file.size > 0) {
          setUploading(true);
          try {
            const meta = await uploadAssetFile({ studioId, projectId, file });
            fd.set("storage_path", meta.storagePath);
            fd.set("mime_type", meta.mimeType);
            fd.set("size_bytes", String(meta.sizeBytes));
          } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Upload failed.");
            setUploading(false);
            return;
          }
          setUploading(false);
        }
        fd.delete("file");
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
      {(state?.error || uploadError) && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {uploadError ?? state?.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Submit busy={uploading} />
      </div>
    </form>
  );
}
