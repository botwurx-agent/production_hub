import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { loadProjectPeople } from "@/lib/people-load";
import type { StudioContext } from "@/lib/studio";
import { checklistJson, matchAssignee, parseTasks, MAX_TASKS } from "@/lib/connector-tasks";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * add_tasks: cards on a project's task board, over the connector. Inserts the
 * same rows addProjectTask does (it cannot call it: that action needs a cookie
 * session), through the owner's borrowed RLS client, so the boundary is the
 * same. Adds only. `done` is generated from status and is never written.
 */

const s = (description: string) => ({ type: "string", description });

export const TASK_TOOL: McpTool = {
  name: "add_tasks",
  description:
    `Add tasks to a project's task board, in the order given, at the top of their column. Up to ${MAX_TASKS} per call. Adds only: nothing existing is changed, so read the project's existing tasks first (query on project_tasks) and do not add one that is already there. Leave out anything the producer did not say: a task with no phase goes under Anytime and one with no status under To do.`,
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: s("What has to be done, short, e.g. 'Book the prop stylist'."),
            notes: s("Detail for the card, if any."),
            due_date: s("YYYY-MM-DD, only if the producer gave a date."),
            phase: s("Which part of the job: pre_pro, shoot, post or delivered. Leave out for Anytime."),
            status: s("todo (default), doing, waiting (sitting with a client, vendor or anyone outside the studio) or done."),
            checklist: { type: "array", items: { type: "string" }, description: "Steps inside the task, shown as a checklist on the card." },
            assignees: {
              type: "array",
              items: { type: "string" },
              description: "Who it is on: 'me' for the person you are talking to, or a team member's email exactly. Anyone not matched is reported and the task is added unassigned.",
            },
          },
          required: ["title"],
          additionalProperties: false,
        },
      },
    },
    required: ["project_id", "tasks"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

type Json = Record<string, unknown>;

export async function addTasksTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }

  const { tasks, skipped } = parseTasks(args.tasks);
  if (!tasks.length) return { error: "No usable tasks to add.", skipped };

  // Only read the people when somebody is named: it is four queries.
  const wantsPeople = tasks.some((t) => t.assignees.length);
  let people: { userId: string; label: string }[] = [];
  if (wantsPeople) {
    const { data: auth } = await supabase.auth.getUser();
    const ctx = {
      studio: { id: owner.studioId },
      userId: owner.userId,
      email: auth.user?.email ?? null,
    } as unknown as StudioContext;
    people = await loadProjectPeople(supabase, ctx, project.id);
  }

  // First task given lands on top, the rest beneath it in order. New cards sit
  // above older ones, the same as a card typed on the board.
  const base = -Date.now() / 1e6;
  const assigned: { index: number; userId: string }[] = [];
  const rows = tasks.map((t, i) => {
    for (const who of t.assignees) {
      const id = matchAssignee(who, people, owner.userId);
      if (id) {
        if (!assigned.some((a) => a.index === i && a.userId === id)) assigned.push({ index: i, userId: id });
      } else {
        skipped.push(`"${t.title}": nobody on this project is "${who}"; left unassigned for them. Use 'me' or a team member's exact email.`);
      }
    }
    return {
      studio_id: owner.studioId,
      project_id: project.id,
      title: t.title,
      notes: t.notes,
      due_date: t.dueDate,
      phase: t.phase,
      status: t.status,
      checklist: checklistJson(t.steps, () => crypto.randomUUID().slice(0, 8)),
      sort: base + i * 0.001,
      created_by: owner.userId,
    };
  });

  const { data: inserted, error } = await supabase.from("project_tasks").insert(rows).select("id, sort");
  if (error || !inserted) return { error: "The tasks could not be saved.", skipped };
  // Rows come back in insert order in practice, but that is not promised, so
  // they are matched on the sort key this call gave each one.
  const idAt = (i: number) => inserted.find((r) => Math.abs(r.sort - rows[i].sort) < 1e-6)?.id;

  let assigneeRows = 0;
  const aRows = assigned
    .map((a) => ({ studio_id: owner.studioId, task_id: idAt(a.index), user_id: a.userId }))
    .filter((a): a is { studio_id: string; task_id: string; user_id: string } => !!a.task_id);
  if (aRows.length) {
    const { error: aErr } = await supabase.from("project_task_assignees").insert(aRows);
    if (aErr) skipped.push("The tasks were added but the people could not be put on them; assign them on the board.");
    else assigneeRows = aRows.length;
  }

  return {
    added: {
      tasks: inserted.length,
      titles: tasks.map((t) => t.title),
      with_checklists: tasks.filter((t) => t.steps.length).length,
      assignments: assigneeRows,
    },
    project: project.title,
    skipped,
    open: `${siteOrigin()}/projects/${project.id}/tasks`,
  };
}
