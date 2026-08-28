"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusTag } from "@/components/status-tag";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { confirmAction } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { ACCOUNT_STATUS } from "@/lib/status";
import {
  deleteClientAccount,
  setAccountStatus,
} from "@/app/(app)/clients/actions";
import type { AccountStatus } from "@/lib/database.types";

const STATUS_ORDER: AccountStatus[] = ["prospect", "active", "past"];

const STATUS_HINT: Record<AccountStatus, string> = {
  prospect: "Not a client yet",
  active: "Working together",
  past: "Relationship ended, history kept",
};

/**
 * The account-status chip doubles as its control, the same move as the project
 * and deal stage chips: click to move between Prospect / Client / Past. Past
 * is the "archive" for a relationship, which is why delete below refuses a
 * client with history.
 */
export function AccountStatusMenu({
  clientId,
  status,
}: {
  clientId: string;
  status: AccountStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const anchorRef = useRef<HTMLButtonElement>(null);

  function set(next: AccountStatus) {
    setOpen(false);
    if (next === status) return;
    start(async () => {
      const res = await setAccountStatus(clientId, next);
      if (res?.error) toast(res.error, "error");
      else router.refresh();
    });
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`transition ${pending ? "opacity-50" : ""}`}
        aria-label="Change account status"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusTag hue={ACCOUNT_STATUS[status].hue}>
          {ACCOUNT_STATUS[status].label}
        </StatusTag>
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        width={230}
        prefer="below"
      >
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set(s)}
            className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition hover:bg-surface-2 ${
              s === status ? "bg-surface-2" : ""
            }`}
          >
            <StatusTag hue={ACCOUNT_STATUS[s].hue}>
              {ACCOUNT_STATUS[s].label}
            </StatusTag>
            <span className="text-xs text-text-faint">{STATUS_HINT[s]}</span>
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}

/**
 * Delete is for a mistake (a typo, a duplicate, a test entry), never for a
 * relationship that ended. A client with any project is refused server-side;
 * here that case gets a pointer to Past instead of a confirm it would fail.
 */
export function DeleteClientButton({
  clientId,
  clientName,
  projectCount,
  contactCount,
  dealCount,
  agreementCount,
}: {
  clientId: string;
  clientName: string;
  projectCount: number;
  contactCount: number;
  dealCount: number;
  agreementCount: number;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  async function remove() {
    if (projectCount > 0) {
      toast(
        `${clientName} has ${projectCount} project${
          projectCount === 1 ? "" : "s"
        }, and that history is worth keeping. Mark the client as Past instead.`,
        "info"
      );
      return;
    }
    const goes = [
      contactCount > 0 &&
        `${contactCount} contact${contactCount === 1 ? "" : "s"}`,
      dealCount > 0 && `${dealCount} deal${dealCount === 1 ? "" : "s"}`,
      agreementCount > 0 &&
        `${agreementCount} agreement${agreementCount === 1 ? "" : "s"}`,
    ].filter(Boolean) as string[];
    const ok = await confirmAction({
      title: `Delete ${clientName}?`,
      body:
        (goes.length
          ? `Their ${goes.join(", ")} and any linked conversations go too. `
          : "") + "This cannot be undone.",
      confirmLabel: "Delete client",
      destructive: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteClientAccount(clientId);
      if (res?.error) {
        toast(res.error, "error");
        return;
      }
      toast(`${clientName} deleted.`, "success");
      router.push("/clients");
      router.refresh();
    });
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="text-xs font-semibold text-text-faint transition hover:text-red disabled:opacity-50"
    >
      {busy ? "Deleting..." : "Delete client"}
    </button>
  );
}
