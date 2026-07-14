"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createDeal, type FormState } from "@/app/(app)/pipeline/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/app-shell/nav-icons";
import { DEAL_STAGE, DEAL_STAGE_ORDER } from "@/lib/status";
import type { AccountOption } from "@/components/deals/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add deal"}
    </Button>
  );
}

export function NewDealButton({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<FormState, FormData>(createDeal, null);
  const [submitted, setSubmitted] = useState(false);
  // "" = pick/new not chosen, "__new__" = add a new company, else an account id.
  const [account, setAccount] = useState("");

  useEffect(() => {
    if (submitted && state === null) {
      setSubmitted(false);
      setOpen(false);
      setAccount("");
    }
  }, [submitted, state]);

  const isNew = account === "__new__";

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> New deal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New deal">
        <form
          action={async (fd) => {
            // Only send account_id when an existing account is picked.
            if (isNew || !account) fd.set("account_id", "");
            else fd.set("account_id", account);
            setSubmitted(true);
            await action(fd);
          }}
          className="space-y-4"
        >
          <Field label="Deal" htmlFor="title">
            <Input
              id="title"
              name="title"
              placeholder="e.g. Summer campaign"
              autoFocus
              required
            />
          </Field>
          <Field label="Company" htmlFor="account">
            <Select
              id="account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Select a company...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="__new__">+ New company</option>
            </Select>
          </Field>
          {isNew && (
            <Field label="New company name" htmlFor="new_account">
              <Input
                id="new_account"
                name="new_account"
                placeholder="e.g. IQ Bar"
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value" htmlFor="value">
              <Input id="value" name="value" placeholder="e.g. 85000" inputMode="numeric" />
            </Field>
            <Field label="Expected close" htmlFor="expected_close_date">
              <Input
                id="expected_close_date"
                name="expected_close_date"
                type="date"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage" htmlFor="stage">
              <Select id="stage" name="stage" defaultValue="inbound">
                {DEAL_STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {DEAL_STAGE[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source" htmlFor="source">
              <Input
                id="source"
                name="source"
                placeholder="e.g. Referral"
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="What's the opportunity?"
              className="min-h-[72px]"
            />
          </Field>
          {state?.error && (
            <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Submit />
          </div>
        </form>
      </Modal>
    </>
  );
}
