import type { ProjectStatus } from "@/lib/database.types";

export type ProjectRow = {
  id: string;
  title: string;
  status: ProjectStatus;
  due_date: string | null;
  shoot_date: string | null;
  client: { name: string } | null;
};
