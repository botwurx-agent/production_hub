"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { submitFeedback } from "@/app/(app)/feedback-actions";

export function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function send() {
    if (!message.trim()) return;
    start(async () => {
      const res = await submitFeedback(message, pathname);
      if (res?.error) {
        toast(res.error, "error");
        return;
      }
      toast("Thanks, your feedback was sent.", "success");
      setMessage("");
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Send feedback">
      <p className="text-sm text-text-muted">
        Found a bug, or have an idea? Tell us what you were doing and what you
        expected. It goes straight to the team.
      </p>
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={5000}
        placeholder="What's on your mind?"
        className="mt-3 w-full resize-y rounded-[11px] border border-border-strong bg-surface px-3 py-2.5 text-sm text-text outline-none transition focus:border-accent"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={send} disabled={pending || !message.trim()}>
          {pending ? "Sending..." : "Send feedback"}
        </Button>
      </div>
    </Modal>
  );
}
