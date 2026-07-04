export type CalendarEvent = {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "shoot" | "due";
  href: string;
  client?: string | null;
};

export type ActivityFeedItem = {
  id: string;
  content: string;
  type: string;
  created_at: string;
  projectId: string;
  projectTitle: string;
};
