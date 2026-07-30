"use server";

// Confirming an action card.
//
// This is the only place the assistant's proposals become real, and it does it
// by calling the ordinary server actions the UI calls. That is the whole
// security design: no new database access, so every guard those actions already
// carry (requireStudioContext, RLS, the money-column split from migration 0074,
// the studio derivation, the revalidate) applies unchanged. If the assistant is
// ever able to do something it should not, the fix belongs in the action, where
// it also protects the buttons.
//
// The payload comes back from the browser, so none of it is trusted. Ids are
// re-read under RLS before use and every value is re-validated here even though
// the card builder already validated it on the way out.

import { requireStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/log";
import { isCardKind, type CardKind } from "@/lib/agent/cards";
import { costStatus } from "@/lib/costs";
import { PROJECT_STATUS } from "@/lib/status";
import type { ProjectStatus } from "@/lib/database.types";

import { addCost, addPayment, setCostStatus } from "@/app/(app)/projects/[id]/cost-actions";
import { addProjectTask } from "@/app/(app)/projects/[id]/task-actions";
import { addTask, logActivity } from "@/app/(app)/pipeline/crm-actions";
import {
  addDeliverable,
  updateDeliverable,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import { updateProjectStatus } from "@/app/(app)/projects/actions";
import { createDeal, updateDealStage, markDealLost } from "@/app/(app)/pipeline/actions";
import { addProjectContact } from "@/app/(app)/projects/[id]/contact-actions";
import { addProjectEvent } from "@/app/(app)/projects/[id]/calendar-actions";
import { CRM_MANUAL_ACTIVITY } from "@/lib/status";
import { loadSuggestions, type Suggestion } from "@/lib/agent/suggestions";
// The SAME parsers the card builder used on the way out. The payload has
// been through the browser since then, so it is parsed again, not trusted.
import { amount as money, count, date as day, str, uuid } from "@/lib/agent/values";
import type { CrmActivityKind } from "@/lib/database.types";

export type ConfirmResult = { ok: true; message: string } | { error: string };

export type AgentContext = {
  projects: { id: string; title: string }[];
  suggestions: Suggestion[];
};

/**
 * What the panel needs the first time it opens: the project list for the
 * selector, and suggestions drawn from real state so it never shows an empty
 * box. Loaded on open rather than threaded through the app shell, so a producer
 * who never opens the assistant pays nothing for it on every page load.
 */
export async function loadAgentContext(
  projectId?: string | null
): Promise<AgentContext> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { projects: [], suggestions: [] };

  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  const projects = data ?? [];
  const selected = projectId ? projects.find((p) => p.id === projectId) : null;

  return {
    projects,
    suggestions: await loadSuggestions(selected?.title ?? null),
  };
}

export type ThreadMessage = {
  role: string;
  content: string;
  cards: unknown;
};

/** Replays a saved conversation into the panel after a reload. */
export async function loadAgentThread(threadId: string): Promise<ThreadMessage[]> {
  await requireStudioContext();
  const supabase = createClient();
  const { data } = await supabase
    .from("agent_messages")
    .select("role, content, cards")
    .eq("thread_id", threadId)
    .in("role", ["user", "assistant"])
    .order("seq");
  // Tool rows are deliberately not replayed: they are model bookkeeping, not
  // conversation, and an assistant row with no text was a pure tool-calling
  // turn with nothing to show.
  return (data ?? []).filter((m) => m.content.trim() || m.cards);
}

type Payload = Record<string, unknown>;

/** Confirms the project is one this user can see before anything is written. */
async function visibleProject(id: unknown): Promise<string | null> {
  const projectId = str(id, 40);
  if (!projectId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function confirmCard(input: {
  kind: string;
  payload: Payload;
}): Promise<ConfirmResult> {
  const ctx = await requireStudioContext();
  // Every action below writes to a studio-member table. A collaborator would be
  // refused by RLS anyway; refusing here means they get a sentence instead of a
  // silent failure.
  if (ctx.isCollaborator) {
    return { error: "That is not something your access allows." };
  }
  if (!isCardKind(input.kind)) {
    return { error: "That is not an action I know how to carry out." };
  }

  try {
    return await run(input.kind, input.payload ?? {});
  } catch (e) {
    reportError(`confirmCard/${input.kind}`, e);
    return { error: "That did not go through. Nothing was saved." };
  }
}

async function run(kind: CardKind, p: Payload): Promise<ConfirmResult> {
  switch (kind) {
    case "log_cost": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const vendor = str(p.vendor, 160);
      const amount = money(p.amount);
      if (!vendor) return { error: "The cost needs a vendor." };
      if (amount === null) return { error: "The amount was not a number." };

      const res = await addCost(projectId, {
        vendor,
        description: str(p.description, 300) ?? "",
        amount,
        days: money(p.days),
        budgetLineId: str(p.budgetLineId, 40),
        contactId: str(p.contactId, 40),
        invoiceNumber: str(p.invoiceNumber, 60),
        invoiceDate: day(p.invoiceDate),
        dueDate: day(p.dueDate),
        status: costStatus(str(p.status, 20) ?? "received"),
        notes: str(p.notes, 500),
      });
      if ("error" in res) return { error: res.error };
      return { ok: true, message: "Cost logged." };
    }

    case "add_payment": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const costId = str(p.costId, 40);
      const amount = money(p.amount);
      if (!costId) return { error: "I lost track of which cost that was for." };
      if (amount === null) return { error: "The amount was not a number." };

      const res = await addPayment(projectId, costId, {
        label: str(p.label, 120) ?? "Payment",
        amount,
        dueDate: day(p.dueDate),
        method: str(p.method, 60),
        notes: str(p.notes, 500),
        paid: p.paid === true,
      });
      if ("error" in res) return { error: res.error };
      return { ok: true, message: p.paid === true ? "Payment recorded." : "Payment scheduled." };
    }

    case "mark_paid": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const costId = str(p.costId, 40);
      if (!costId) return { error: "I lost track of which cost that was." };
      const res = await setCostStatus(projectId, costId, costStatus(str(p.status, 20) ?? "paid"));
      if ("error" in res) return { error: res.error };
      return { ok: true, message: "Status updated." };
    }

    case "create_task": {
      const title = str(p.title, 200);
      if (!title) return { error: "The task lost its title." };
      const due = day(p.dueDate);

      if (p.scope === "project") {
        const projectId = await visibleProject(p.projectId);
        if (!projectId) return { error: "That project is no longer visible." };
        const res = await addProjectTask(projectId, title, due);
        if ("error" in res) return { error: res.error };
        return { ok: true, message: "Task added to the project." };
      }

      const accountId = str(p.accountId, 40);
      const dealId = str(p.dealId, 40);
      if (!accountId && !dealId) return { error: "The task lost what it was attached to." };
      await addTask({ accountId, dealId, title, dueDate: due });
      return { ok: true, message: "Task added." };
    }

    case "log_activity": {
      const body = str(p.body, 2000);
      if (!body) return { error: "The note was empty." };
      const accountId = str(p.accountId, 40);
      const dealId = str(p.dealId, 40);
      if (!accountId && !dealId) return { error: "The note lost what it was attached to." };
      const raw = str(p.kind, 20) ?? "note";
      const activityKind = (
        CRM_MANUAL_ACTIVITY as readonly string[]
      ).includes(raw)
        ? (raw as CrmActivityKind)
        : ("note" as CrmActivityKind);
      await logActivity({ accountId, dealId, kind: activityKind, body });
      return { ok: true, message: "Logged to the timeline." };
    }

    case "add_deliverable": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const name = str(p.name, 200);
      if (!name) return { error: "The deliverable lost its name." };

      // addDeliverable creates a blank row and returns the page state rather
      // than the new id, so the row is read back by position. Fine here: the
      // assistant writes one at a time for one signed-in person, and the worst
      // case of a race is that the detail lands on a deliverable added a moment
      // earlier, which is visible and editable on the page either way.
      await addDeliverable(projectId);
      const supabase = createClient();
      const { data: row } = await supabase
        .from("deliverables")
        .select("id")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row) return { error: "The deliverable was not created." };

      const qty = count(p.qty);
      await updateDeliverable(projectId, row.id, {
        name,
        spec: str(p.spec, 300) ?? "",
        due_date: day(p.dueDate),
        notes: str(p.notes, 500) ?? "",
        ...(qty ? { qty } : {}),
      });
      return { ok: true, message: "Deliverable added." };
    }

    case "move_project_stage": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const status = str(p.status, 20) ?? "";
      if (!(status in PROJECT_STATUS)) return { error: "That is not a stage." };
      const res = await updateProjectStatus(projectId, status as ProjectStatus);
      if (res && "error" in res && res.error) return { error: res.error };
      return { ok: true, message: "Stage moved." };
    }

    case "move_deal_stage": {
      const dealId = str(p.dealId, 40);
      const stage = str(p.stage, 20) ?? "";
      if (!dealId) return { error: "I lost track of which deal that was." };
      if (stage === "lost") {
        const reason = str(p.lostReason, 300);
        if (!reason) return { error: "Marking a deal lost needs a reason." };
        await markDealLost(dealId, reason);
        return { ok: true, message: "Deal marked lost." };
      }
      // updateDealStage validates the stage itself and ignores an unknown one.
      await updateDealStage(dealId, stage as Parameters<typeof updateDealStage>[1]);
      return { ok: true, message: "Deal moved." };
    }

    case "create_deal": {
      const title = str(p.title, 200);
      if (!title) return { error: "The deal lost its title." };
      const accountId = str(p.accountId, 40);
      const newAccount = str(p.newAccount, 160);
      if (!accountId && !newAccount) return { error: "The deal needs a company." };

      // createDeal is a form action, so it is called the way the form calls it.
      // Going through the same door means the account creation, the activity
      // event and the validation all behave identically.
      const form = new FormData();
      form.set("title", title);
      if (accountId) form.set("account_id", accountId);
      if (newAccount) form.set("new_account", newAccount);
      form.set("stage", str(p.stage, 20) ?? "inbound");
      const value = money(p.value);
      if (value !== null) form.set("value", String(value));
      const close = day(p.expectedCloseDate);
      if (close) form.set("expected_close_date", close);
      const source = str(p.source, 80);
      if (source) form.set("source", source);
      const notes = str(p.notes, 500);
      if (notes) form.set("notes", notes);

      const res = await createDeal({}, form);
      if (res && "error" in res && res.error) return { error: res.error };
      return { ok: true, message: "Deal created." };
    }

    case "add_contact": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const name = str(p.name, 160);
      if (!name) return { error: "The contact lost their name." };

      const res = await addProjectContact(projectId, {
        name,
        role: str(p.role, 120),
        type: str(p.type, 20) ?? "crew",
        company: str(p.company, 160),
        email: str(p.email, 200),
        phone: str(p.phone, 60),
        rate: money(p.rate),
        notes: str(p.notes, 500),
      });
      if (res && "error" in res && res.error) return { error: res.error };
      return { ok: true, message: "Added to the roster." };
    }

    case "add_event": {
      const projectId = await visibleProject(p.projectId);
      if (!projectId) return { error: "That project is no longer visible." };
      const title = str(p.title, 200);
      const date = day(p.date);
      if (!title) return { error: "The date lost its title." };
      if (!date) return { error: "That was not a real date." };

      const res = await addProjectEvent(projectId, {
        title,
        date,
        endDate: day(p.endDate),
        kind: str(p.kind, 20) ?? "other",
        notes: str(p.notes, 500) ?? "",
      });
      if (res && "error" in res && res.error) return { error: res.error };
      return { ok: true, message: "Date added." };
    }
  }
}
