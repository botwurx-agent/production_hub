"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DrivePickerModal } from "@/components/projects/drive-browser";

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

export function DriveImportButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <DriveGlyph /> Import from Drive
      </Button>
      <DrivePickerModal
        open={open}
        onClose={() => setOpen(false)}
        mode="import"
        projectId={projectId}
      />
    </>
  );
}
