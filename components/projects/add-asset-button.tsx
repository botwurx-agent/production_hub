"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createAsset,
  addVersion,
  type ActionState,
} from "@/app/(app)/projects/[id]/actions";
import { uploadAssetFile } from "@/components/projects/upload-file";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { ASSET_TYPE_LABEL } from "@/lib/status";
import { findVersionParent } from "@/lib/asset-name";
import { VersionSuggestion } from "@/components/projects/version-suggestion";

const TYPES = ["image", "video", "storyboard", "reference", "cut", "other"];

export type ExistingAsset = { id: string; name: string; nextVersion: number };

function Submit({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || busy}>
      {pending || busy ? "Adding..." : "Add asset"}
    </Button>
  );
}

export function AddAssetButton({
  projectId,
  studioId,
  existingAssets = [],
}: {
  projectId: string;
  studioId: string;
  existingAssets?: ExistingAsset[];
}) {
  const [open, setOpen] = useState(false);
  const bound = createAsset.bind(null, projectId);
  const [state, action] = useFormState<ActionState, FormData>(bound, null);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  // The file this one looks like a version of, once accepted. Dismissing sets
  // the ignore flag so the banner stays gone while they keep typing.
  const [versionOf, setVersionOf] = useState<ExistingAsset | null>(null);
  const [ignored, setIgnored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const match = versionOf ?? findVersionParent(name, existingAssets);
  const showSuggestion = Boolean(match) && (Boolean(versionOf) || !ignored);

  function reset() {
    formRef.current?.reset();
    setName("");
    setVersionOf(null);
    setIgnored(false);
  }

  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      setOpen(false);
      reset();
    }
  }, [submitted, state]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <PlusIcon /> Add asset
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add asset">
        <form
          ref={formRef}
          action={async (fd) => {
            setUploadError(null);
            const file = fd.get("file");
            // Upload bytes straight to Storage, then send only metadata.
            if (file instanceof File && file.size > 0) {
              setUploading(true);
              try {
                const meta = await uploadAssetFile({
                  studioId,
                  projectId,
                  file,
                });
                fd.set("storage_path", meta.storagePath);
                fd.set("mime_type", meta.mimeType);
                fd.set("size_bytes", String(meta.sizeBytes));
              } catch (e) {
                setUploadError(
                  e instanceof Error ? e.message : "Upload failed."
                );
                setUploading(false);
                return;
              }
              setUploading(false);
            }
            fd.delete("file");
            // Accepted the suggestion: this goes onto the existing file as its
            // next version, so the name/type on this form are not used.
            if (versionOf) {
              const res = await addVersion(versionOf.id, null, fd);
              if (res?.error) {
                setUploadError(res.error);
                return;
              }
              setOpen(false);
              reset();
              router.refresh();
              return;
            }
            setSubmitted(true);
            await action(fd);
          }}
          className="space-y-4"
        >
          {!versionOf && (
            <>
              <Field label="Asset name" htmlFor="name">
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
            </>
          )}

          {showSuggestion && match && (
            <VersionSuggestion
              parentName={match.name}
              nextVersion={match.nextVersion}
              accepted={Boolean(versionOf)}
              onAccept={() => setVersionOf(match)}
              onUndo={() => {
                setVersionOf(null);
                setIgnored(true);
              }}
            />
          )}
          <Field
            label={versionOf ? "File" : "First version file"}
            htmlFor="file"
            hint={
              versionOf
                ? "The file for this new version."
                : "Optional. You can add versions later."
            }
          >
            <Input id="file" name="file" type="file" />
          </Field>
          <Field label="Or paste a link" htmlFor="url">
            <Input id="url" name="url" type="url" placeholder="https://..." />
          </Field>
          <Field
            label="Version number"
            htmlFor="version_number"
            hint="Change it if this file is really a later version."
          >
            <Input
              // Remount so the default follows the chosen parent's sequence.
              key={versionOf?.id ?? "new"}
              id="version_number"
              name="version_number"
              type="number"
              min={1}
              max={9999}
              step={1}
              defaultValue={versionOf?.nextVersion ?? 1}
              className="max-w-[120px]"
            />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="Notes for this first version"
              className="min-h-[64px]"
            />
          </Field>
          {(state?.error || uploadError) && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {uploadError ?? state?.error}
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
            <Submit busy={uploading} />
          </div>
        </form>
      </Modal>
    </>
  );
}
