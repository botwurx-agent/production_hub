// Server-only Google Calendar REST helpers. All calls act as the connected
// Google user (primary calendar), using the same Google tokens as Gmail/Drive.
import "server-only";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Calendar rides on the Google account's granted scopes.
export function calendarConnected(scope: string | null | undefined): boolean {
  return (scope ?? "").includes("/auth/calendar");
}

export type GCalEvent = {
  id: string;
  title: string;
  allDay: boolean;
  // Raw start/end as Google returns them: `date` (all-day) or `dateTime`.
  start: string;
  end: string;
  meetLink: string | null;
  htmlLink: string | null;
};

type RawEvent = {
  id?: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

function meetOf(e: RawEvent): string | null {
  if (e.hangoutLink) return e.hangoutLink;
  const video = e.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video"
  );
  return video?.uri ?? null;
}

// Lists events on the primary calendar between two ISO timestamps.
export async function listEvents(
  token: string,
  timeMinISO: string,
  timeMaxISO: string
): Promise<GCalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`${API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: RawEvent[] };
  return (data.items ?? [])
    .filter((e) => e.id && e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
    .map((e) => {
      const allDay = Boolean(e.start?.date);
      return {
        id: e.id!,
        title: e.summary || "(no title)",
        allDay,
        start: (e.start?.dateTime || e.start?.date)!,
        end: (e.end?.dateTime || e.end?.date || e.start?.dateTime || e.start?.date)!,
        meetLink: meetOf(e),
        htmlLink: e.htmlLink ?? null,
      };
    });
}

export type CreateEventInput = {
  title: string;
  allDay: boolean;
  // For timed events: ISO dateTime strings. For all-day: YYYY-MM-DD (end
  // exclusive, i.e. the day after the last day).
  start: string;
  end: string;
  timeZone: string;
  description?: string;
  addMeet?: boolean;
};

// Creates an event on the primary calendar; optionally attaches a Meet link.
export async function createEvent(
  token: string,
  input: CreateEventInput
): Promise<GCalEvent> {
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description || undefined,
    start: input.allDay
      ? { date: input.start }
      : { dateTime: input.start, timeZone: input.timeZone },
    end: input.allDay
      ? { date: input.end }
      : { dateTime: input.end, timeZone: input.timeZone },
  };
  if (input.addMeet) {
    body.conferenceData = {
      createRequest: {
        // Deterministic-ish request id; Google only needs it unique per event.
        requestId: `hub-${input.start}-${input.title.slice(0, 20)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  const res = await fetch(`${API}?conferenceDataVersion=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Calendar create ${res.status}: ${await res.text()}`);
  }
  const e = (await res.json()) as RawEvent;
  return {
    id: e.id!,
    title: e.summary || input.title,
    allDay: input.allDay,
    start: (e.start?.dateTime || e.start?.date)!,
    end: (e.end?.dateTime || e.end?.date)!,
    meetLink: meetOf(e),
    htmlLink: e.htmlLink ?? null,
  };
}

export async function deleteEvent(token: string, eventId: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 410 = already deleted; treat as success.
  if (!res.ok && res.status !== 410) {
    throw new Error(`Calendar delete ${res.status}: ${await res.text()}`);
  }
}
