"use client";

import { useState, useTransition } from "react";
import { updateLeadNotes } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function LeadNotesEditor({
  leadId,
  initialContent,
}: {
  leadId: string;
  initialContent: string;
}) {
  const [value, setValue] = useState(initialContent);
  const [saved, setSaved] = useState<string>(initialContent);
  const [pending, startTransition] = useTransition();
  const dirty = value !== saved;

  function save() {
    startTransition(async () => {
      await updateLeadNotes(leadId, value);
      setSaved(value);
    });
  }

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Notes on this lead: how you met, what they need, call notes, next steps. Add to this as the conversation develops."
        className="min-h-[140px]"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving..." : "Save notes"}
        </Button>
        {!dirty && saved && (
          <span className="text-xs text-text-faint">Saved</span>
        )}
      </div>
    </div>
  );
}
