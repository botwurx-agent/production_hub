"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addActivity, type ActionState } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatusTag } from "@/components/status-tag";
import { timeAgo } from "@/lib/format";
import type { ActivityType } from "@/lib/database.types";

export type ActivityItem = {
  id: string;
  content: string;
  type: ActivityType;
  created_at: string;
  author_id: string | null;
};

const typeHue: Partial<Record<ActivityType, "indigo" | "green" | "orange">> = {
  upload: "green",
  status_change: "orange",
  approval: "indigo",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Posting..." : "Add note"}
    </Button>
  );
}

export function ActivityPanel({
  projectId,
  items,
  currentUserId,
}: {
  projectId: string;
  items: ActivityItem[];
  currentUserId: string;
}) {
  const boundAction = addActivity.bind(null, projectId);
  const [state, action] = useFormState<ActionState, FormData>(boundAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box after a successful post (no error, form still mounted).
  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state, items.length]);

  return (
    <div className="flex flex-col">
      <form ref={formRef} action={action} className="mb-4">
        <Textarea
          name="content"
          placeholder="Add an internal note or update..."
          className="min-h-[72px]"
        />
        {state?.error && (
          <p className="mt-1 text-xs font-medium text-red">{state.error}</p>
        )}
        <div className="mt-2 flex justify-end">
          <Submit />
        </div>
      </form>

      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-faint">
          No activity yet. Notes and updates for the team live here.
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" />
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-text">
                    {item.author_id === currentUserId ? "You" : "Team"}
                  </span>
                  {item.type !== "note" && typeHue[item.type] && (
                    <StatusTag hue={typeHue[item.type]!} dot={false}>
                      {item.type.replace("_", " ")}
                    </StatusTag>
                  )}
                  <span className="text-xs text-text-faint">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                  {item.content}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
