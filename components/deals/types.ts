import type { DealStage } from "@/lib/database.types";

export type DealRow = {
  id: string;
  title: string;
  value: number | null;
  stage: DealStage;
  expected_close_date: string | null;
  owner_id: string | null;
  account_id: string;
  account_name: string;
  won_project_id: string | null;
};

// A company the new-deal form can attach a deal to.
export type AccountOption = { id: string; name: string };
