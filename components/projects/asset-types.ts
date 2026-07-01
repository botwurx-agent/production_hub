import type { AssetStatus, AssetType } from "@/lib/database.types";

export type VersionRow = {
  id: string;
  version_number: number;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
  signedUrl: string | null;
};

export type AssetWithVersions = {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  current_version_id: string | null;
  versions: VersionRow[];
};
