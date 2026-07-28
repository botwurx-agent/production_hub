import type { ProjectStatus } from "@/lib/database.types";

export type ProjectRow = {
  id: string;
  title: string;
  status: ProjectStatus;
  due_date: string | null;
  shoot_date: string | null;
  client: { name: string } | null;
  archived: boolean;
  color: string | null;
  // When the job was created. Only the slate uses it, to anchor the pre-pro
  // run when a project has a shoot date but no explicit pre-pro event.
  created_at: string | null;
};
