"use server";

// Live view: a Google Meet link made from the project, for a client who
// cannot be on set. Studio Flows starts the call and remembers the link; the
// call itself is Google's and opens in its own tab. The link is made through
// a calendar event on the presser's own Google account, which is the access
// the Calendar connection already has, so no new Google permission is asked.
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getAccessToken } from "@/lib/gmail";
import { calendarConnected, createEvent, deleteEvent } from "@/lib/googlecalendar";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress } from "@/lib/contact";
import { reportError } from "@/lib/log";

export type LiveView = { url: string; hostEmail: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The presser's own Google account: whoever makes the link hosts the call. */
async function myGoogle(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, email, access_token, refresh_token, token_expiry, scope")
    .eq("provider", "google")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Makes the project's Meet link, or returns the one it has. `fresh` replaces
 * it with a new link (the old one keeps working at Google; we just stop
 * pointing at it). `today` is the presser's local day, so the calendar entry
 * lands on the day they pressed.
 */
export async function startLiveView(
  projectId: string,
  opts: { today: string; timeZone: string; fresh?: boolean }
): Promise<LiveView | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can start a live view." };
  if (!DAY.test(opts.today)) return { error: "Could not read today's date." };
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: existing } = await supabase
    .from("project_live_views")
    .select("id, meet_url, event_id, host_email")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing && !opts.fresh) return { url: existing.meet_url, hostEmail: existing.host_email };

  const account = await myGoogle(supabase, ctx.userId);
  if (!account) return { error: "Connect your Google account in Settings, Connections first." };
  if (!calendarConnected(account.scope))
    return { error: "Reconnect Google in Settings, Connections to allow Calendar, then try again." };

  let url: string | null = null;
  let eventId: string | null = null;
  try {
    const token = await getAccessToken(supabase, account);
    const event = await createEvent(token, {
      title: `Live view: ${project.title}`,
      allDay: true,
      start: opts.today,
      end: nextDay(opts.today),
      timeZone: opts.timeZone || "UTC",
      description: `The call for clients watching ${project.title} remotely. Made in Studio Flows.`,
      addMeet: true,
      requestId: `sf-live-${randomUUID()}`,
    });
    url = event.meetLink;
    eventId = event.id;
  } catch (e) {
    reportError("startLiveView/create", e);
    return { error: "Google would not make the call. Reconnect Google in Settings and try again." };
  }
  if (!url) return { error: "Google made the calendar entry but gave no Meet link. Check that Meet is on for this Google account." };

  const row = {
    studio_id: ctx.studio.id,
    project_id: projectId,
    meet_url: url,
    event_id: eventId,
    host_email: account.email,
    created_by: ctx.userId,
  };
  const { error } = existing
    ? await supabase.from("project_live_views").update(row).eq("id", existing.id)
    : await supabase.from("project_live_views").insert(row);
  if (error) {
    reportError("startLiveView/save", error);
    return { error: "The call was made but could not be saved on the project. Try again." };
  }
  revalidatePath(`/projects/${projectId}`);
  return { url, hostEmail: account.email };
}

/** Takes the link off the project and, where it can, the entry off the calendar. */
export async function removeLiveView(projectId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can remove a live view." };
  const supabase = createClient();
  const { data: row } = await supabase
    .from("project_live_views")
    .select("id, event_id, created_by")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!row) return { ok: true };
  const { error } = await supabase.from("project_live_views").delete().eq("id", row.id);
  if (error) {
    reportError("removeLiveView", error);
    return { error: error.message };
  }
  // Best effort, and only on the calendar it was made on.
  if (row.event_id && row.created_by === ctx.userId) {
    try {
      const account = await myGoogle(supabase, ctx.userId);
      if (account) await deleteEvent(await getAccessToken(supabase, account), row.event_id);
    } catch (e) {
      reportError("removeLiveView/calendar", e);
    }
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Emails the link to the client. Gated on emailConfigured(). */
export async function emailLiveView(
  projectId: string,
  input: { to: string; subject: string; message?: string }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can send a live view." };
  if (!emailConfigured()) return { error: "Email is not set up yet." };
  const to = input.to.trim();
  if (!isEmailAddress(to)) return { error: "Enter a valid recipient email." };
  const supabase = createClient();
  const { data: row } = await supabase
    .from("project_live_views")
    .select("meet_url")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!row) return { error: "Start the live view first." };
  const { data: project } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
  const title = project?.title ?? "the shoot";
  const subject = input.subject.trim() || `${title}: watch the shoot live`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `${ctx.studio.name} has set up a live view of ${title}, so you can watch the camera and talk with the set from wherever you are.`,
        "It opens in Google Meet in your browser. You may be asked to wait a moment until the set lets you in.",
      ];
  const { html, text } = renderEmail({
    heading: subject,
    lines,
    ctaLabel: "Join the live view",
    ctaUrl: row.meet_url,
  });
  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  return { ok: true };
}
