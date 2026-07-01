"use client";

import { useState, useTransition } from "react";
import { saveBrief } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function BriefEditor({
  projectId,
  initialContent,
}: {
  projectId: string;
  initialContent: string;
}) {
  const [value, setValue] = useState(initialContent);
  const [saved, setSaved] = useState<string>(initialContent);
  const [pending, startTransition] = useTransition();
  const dirty = value !== saved;

  function save() {
    startTransition(async () => {
      await saveBrief(projectId, value);
      setSaved(value);
    });
  }

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste or write the creative direction for this project: the ask, references, deliverables, must-haves."
        className="min-h-[140px]"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving..." : "Save brief"}
        </Button>
        {!dirty && saved && (
          <span className="text-xs text-text-faint">Saved</span>
        )}
      </div>
    </div>
  );
}
