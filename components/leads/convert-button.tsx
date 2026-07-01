"use client";

import { useTransition } from "react";
import { convertLead } from "@/app/(app)/leads/actions";
import { Button } from "@/components/ui/button";

export function ConvertButton({
  leadId,
  size = "sm",
}: {
  leadId: string;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => convertLead(leadId))}
    >
      {pending ? "Converting..." : "Convert to client"}
    </Button>
  );
}
