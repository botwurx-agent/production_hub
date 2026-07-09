"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/app/(app)/settings/team-actions";

// Joins the signed-in user to the studio that invited their email.
export function AcceptInvite() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function go() {
    setErr(null);
    start(async () => {
      const res = await acceptInvite();
      if (res.error) {
        setErr(res.error);
        return;
      }
      if ((res.joined ?? 0) > 0) {
        router.push("/dashboard");
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
        {busy ? "Joining…" : "Accept & continue"}
      </Button>
      {err && (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {err}
        </p>
      )}
    </div>
  );
}
