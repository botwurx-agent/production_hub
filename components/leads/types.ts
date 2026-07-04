import type { LeadStage } from "@/lib/database.types";

export type LeadRow = {
  id: string;
  company: string;
  source: string | null;
  stage: LeadStage;
  converted_client_id: string | null;
};
