export type CalendarEvent = {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "shoot" | "due";
  href: string;
};
