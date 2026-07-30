// Opening suggestions.
//
// A chat panel with an empty box is how these features die: you open it, you
// do not know what it can do, you ask for something it cannot, and you never
// come back. It also fails the project's own bar, since a flow that needs
// explaining is not done.
//
// So the panel never opens empty. These are drawn from the studio's REAL
// current state, not from a generic list, which does two jobs at once: it
// teaches the capability by example, and the first thing on screen is already
// worth pressing.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOutstanding } from "@/lib/outstanding";

export type Suggestion = { label: string; prompt: string };

export async function loadSuggestions(
  projectTitle?: string | null
): Promise<Suggestion[]> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const out: Suggestion[] = [];

  const [outstanding, overdueCosts, openDeals, dueTasks] = await Promise.all([
    getOutstanding().catch(() => []),
    supabase
      .from("project_costs")
      .select("id, vendor, due_date, status")
      .neq("status", "paid")
      .not("due_date", "is", null)
      .lt("due_date", today)
      .limit(1),
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .in("stage", ["inbound", "qualifying", "bidding"]),
    supabase
      .from("crm_tasks")
      .select("id, title")
      .eq("done", false)
      .not("due_date", "is", null)
      .lte("due_date", today)
      .limit(1),
  ]);

  // The selected project first: it is what the producer is already looking at.
  if (projectTitle) {
    out.push({
      label: `Where does ${projectTitle} stand?`,
      prompt: `Where does ${projectTitle} stand?`,
    });
  }

  const stalled = outstanding.filter((o) => o.stalled);
  if (stalled.length) {
    out.push({
      label: `What is stalled on ${stalled[0].projectTitle}?`,
      prompt: `What is stalled on ${stalled[0].projectTitle} and who is it waiting on?`,
    });
  }

  const overdue = overdueCosts.data?.[0];
  if (overdue?.vendor) {
    out.push({
      label: `Mark the ${overdue.vendor} payment as sent`,
      prompt: `Mark the payment to ${overdue.vendor} as sent.`,
    });
  }

  if (dueTasks.data?.[0]?.title) {
    out.push({
      label: "What is due today?",
      prompt: "What tasks and payments are due today or overdue?",
    });
  }

  out.push({
    label: "What is at risk this week?",
    prompt: "What is at risk this week across every job?",
  });

  out.push({
    label: "How much are we still owed?",
    prompt: "How much are we still owed across every project, and what is overdue?",
  });

  if ((openDeals.count ?? 0) > 0) {
    out.push({
      label: "What is in the pipeline?",
      prompt: "What is in the pipeline right now and what should I chase?",
    });
  }

  // Four is enough to teach the range without turning the panel into a menu.
  return out.slice(0, 4);
}
