"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import {
  AddAssetModal,
  type ExistingAsset,
} from "@/components/projects/add-asset-button";
import { DrivePickerModal } from "@/components/projects/drive-browser";
import { FigmaImportModal } from "@/components/projects/figma-import-button";

// One entry point for every way a file gets into the project, instead of a row
// of connector buttons that grows with each new connector. Sources the studio
// has not connected are simply absent.

function UploadGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 9l5-5 5 5M12 4v12" />
    </svg>
  );
}

function DriveGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.4 3.5h7.2l6.4 11.1-3.6 6.2H5.6L2 14.6 8.4 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M2 14.6h20M8.4 3.5l7.2 22M15.6 3.5 8.4 25.5" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
    </svg>
  );
}

function FigmaGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 0 0 0 8z" opacity=".7" />
      <path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" opacity=".55" />
      <path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" opacity=".85" />
      <path d="M12 0h4a4 4 0 0 1 0 8h-4z" opacity=".7" />
      <path d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

type Source = "upload" | "drive" | "figma";

export function AddAssetMenu({
  projectId,
  studioId,
  existingAssets = [],
  driveEnabled = false,
  figmaEnabled = false,
}: {
  projectId: string;
  studioId: string;
  existingAssets?: ExistingAsset[];
  driveEnabled?: boolean;
  figmaEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function pick(next: Source) {
    setOpen(false);
    setSource(next);
  }

  const items: { key: Source; label: string; hint: string; icon: JSX.Element }[] =
    [
      {
        key: "upload",
        label: "Upload a file",
        hint: "From this device, or paste a link",
        icon: <UploadGlyph />,
      },
    ];
  if (driveEnabled) {
    items.push({
      key: "drive",
      label: "Import from Drive",
      hint: "Browse or search your Google Drive",
      icon: <DriveGlyph />,
    });
  }
  if (figmaEnabled) {
    items.push({
      key: "figma",
      label: "Import from Figma",
      hint: "Pull frames from a Figma file",
      icon: <FigmaGlyph />,
    });
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <PlusIcon /> Add asset
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-0.5 opacity-70"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Button>
        {open && (
          <div className="absolute right-0 top-10 z-30 w-64 overflow-hidden rounded-[13px] border border-border bg-surface p-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.key}
                onClick={() => pick(it.key)}
                className="flex w-full items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition hover:bg-surface-2"
              >
                <span className="mt-0.5 text-text-muted">{it.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">
                    {it.label}
                  </span>
                  <span className="block text-xs text-text-faint">
                    {it.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AddAssetModal
        open={source === "upload"}
        onClose={() => setSource(null)}
        projectId={projectId}
        studioId={studioId}
        existingAssets={existingAssets}
      />
      {driveEnabled && (
        <DrivePickerModal
          open={source === "drive"}
          onClose={() => setSource(null)}
          mode="import"
          projectId={projectId}
        />
      )}
      {figmaEnabled && (
        <FigmaImportModal
          open={source === "figma"}
          onClose={() => setSource(null)}
          projectId={projectId}
        />
      )}
    </>
  );
}
