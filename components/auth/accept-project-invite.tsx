"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptProjectInvite } from "@/app/(app)/projects/[id]/team-actions";

// Joins the signed-in user to the project(s) that invited their email, then
// lands them on the project.
export function AcceptProjectInvite() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setErr(null);
    start(async () => {
      const res = await acceptProjectInvite();
      if (res.error) {
        setErr(res.error);
        return;
      }
      if (res.projectId) {
        router.push(`/projects/${res.projectId}`);
        router.refresh();
      } else {
        setErr(
          "This account wasn't the one invited. Sign out and sign up with the invited email address."
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={go} disabled={busy} className="w-full">
        {busy ? "Joining…" : "Accept & open project"}
      </Button>
      {err && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {err}
        </p>
      )}
    </div>
  );
}
