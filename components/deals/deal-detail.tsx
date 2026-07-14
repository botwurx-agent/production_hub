"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateDeal,
  markDealLost,
  deleteDeal,
  type FormState,
} from "@/app/(app)/pipeline/actions";
import { DealStageMenu } from "@/components/deals/deal-stage-menu";
import { ActivityTimeline, type ActivityItem } from "@/components/crm/activity-timeline";
import { TaskList, type TaskItem } from "@/components/crm/task-list";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusTag } from "@/components/status-tag";
import { ACCOUNT_STATUS } from "@/lib/status";
import type { Deal, AccountStatus } from "@/lib/database.types";

type DealContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}

export function DealDetail({
  deal,
  account,
  contacts,
  activities,
  tasks,
}: {
  deal: Deal;
  account: { id: string; name: string; account_status: AccountStatus };
  contacts: DealContact[];
  activities: ActivityItem[];
  tasks: TaskItem[];
}) {
  const router = useRouter();
  const update = updateDeal.bind(null, deal.id);
  const [state, action] = useFormState<FormState, FormData>(update, null);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState(deal.lost_reason ?? "");
  const [delOpen, setDelOpen] = useState(false);

  const status = ACCOUNT_STATUS[account.account_status];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      {/* Left: editable deal fields */}
      <div className="space-y-6">
        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <DealStageMenu dealId={deal.id} stage={deal.stage} />
            <Link
              href={`/clients/${account.id}`}
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent"
            >
              {account.name}
              <StatusTag hue={status.hue}>{status.label}</StatusTag>
            </Link>
          </div>

          {deal.stage === "awarded" && !deal.won_project_id && (
            <div className="mb-4 rounded-[10px] border border-border bg-surface-2/60 px-3 py-2 text-sm text-text-muted">
              Awarded. Start a project for {account.name} from the{" "}
              <Link href="/projects" className="font-semibold text-accent hover:underline">
                Projects
              </Link>{" "}
              page.
            </div>
          )}

          <form action={action} className="space-y-4">
            <Field label="Deal" htmlFor="title">
              <Input id="title" name="title" defaultValue={deal.title} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value" htmlFor="value">
                <Input
                  id="value"
                  name="value"
                  inputMode="numeric"
                  defaultValue={deal.value ?? ""}
                  placeholder="e.g. 85000"
                />
              </Field>
              <Field label="Expected close" htmlFor="expected_close_date">
                <Input
                  id="expected_close_date"
                  name="expected_close_date"
                  type="date"
                  defaultValue={deal.expected_close_date ?? ""}
                />
              </Field>
            </div>
            <Field label="Source" htmlFor="source">
              <Input
                id="source"
                name="source"
                defaultValue={deal.source ?? ""}
                placeholder="e.g. Referral"
              />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                defaultValue={deal.notes ?? ""}
                className="min-h-[96px]"
                placeholder="What's the opportunity?"
              />
            </Field>
            {state?.error && (
              <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                {state.error}
              </p>
            )}
            <div className="flex justify-end">
              <SaveBtn />
            </div>
          </form>
        </div>

        {deal.stage === "lost" && deal.lost_reason && (
          <div className="rounded-[12px] border border-border bg-surface p-4 text-sm">
            <span className="font-semibold text-text">Lost reason: </span>
            <span className="text-text-muted">{deal.lost_reason}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {deal.stage !== "lost" && (
            <button
              onClick={() => setLostOpen(true)}
              className="text-sm font-semibold text-text-muted hover:text-red"
            >
              Mark lost
            </button>
          )}
          <button
            onClick={() => setDelOpen(true)}
            className="text-sm font-semibold text-text-muted hover:text-red"
          >
            Delete deal
          </button>
        </div>

        {/* Activity timeline */}
        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-sm">
          <h3 className="mb-3 font-display text-sm font-bold">Activity</h3>
          <ActivityTimeline dealId={deal.id} activities={activities} />
        </div>
      </div>

      {/* Right rail: tasks + account contacts */}
      <div className="space-y-6">
        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-sm">
          <h3 className="mb-3 font-display text-sm font-bold">Tasks</h3>
          <TaskList dealId={deal.id} tasks={tasks} />
        </div>

        <div className="rounded-[16px] border border-border bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Contacts</h3>
            <Link
              href={`/clients/${account.id}`}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Manage
            </Link>
          </div>
          {contacts.length === 0 ? (
          <p className="text-xs text-text-faint">
            No contacts on this company yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="font-semibold text-text">{c.name}</div>
                {(c.role || c.email) && (
                  <div className="text-xs text-text-muted">
                    {[c.role, c.email].filter(Boolean).join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {/* Mark lost modal */}
      <Modal open={lostOpen} onClose={() => setLostOpen(false)} title="Mark deal lost">
        <div className="space-y-4">
          <Field label="Reason (optional)" htmlFor="lost_reason">
            <Textarea
              id="lost_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Budget, timing, went with another studio"
              className="min-h-[72px]"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                markDealLost(deal.id, reason).then(() => {
                  setLostOpen(false);
                  router.refresh();
                })
              }
            >
              Mark lost
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete deal">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            This removes the deal permanently. The company and its contacts stay.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                deleteDeal(deal.id).then(() => router.push("/pipeline"))
              }
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
