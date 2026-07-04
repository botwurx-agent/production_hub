"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  uploadStudioLogo,
  removeStudioLogo,
} from "@/app/(app)/settings/branding-actions";

export function LogoUpload({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function upload(files: FileList | null) {
    if (!files?.[0]) return;
    const fd = new FormData();
    fd.set("file", files[0]);
    setError(null);
    start(async () => {
      const res = await uploadStudioLogo(fd);
      if (res?.error) setError(res.error);
      else router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  }
  function remove() {
    setError(null);
    start(async () => {
      const res = await removeStudioLogo();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-muted">
        Your logo appears on call sheets, shot boards, and the sidebar. PNG with a
        transparent background works best.
      </p>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-border bg-surface-2/60">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Studio logo" className="h-full w-full object-contain p-1.5" />
          ) : (
            <span className="text-xs font-semibold text-text-faint">No logo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "..." : logoUrl ? "Replace" : "Upload logo"}
          </Button>
          {logoUrl && (
            <Button size="sm" variant="secondary" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      {error && (
        <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {error}
        </p>
      )}
    </div>
  );
}
