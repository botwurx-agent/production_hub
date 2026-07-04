// Server-only Google Drive REST helpers. All calls act as the connected Google
// user, using the same Google tokens as Gmail/Chat (refreshed via getAccessToken
// in lib/gmail.ts). Read-only: search files and pull their bytes to import into
// a project's assets.
import "server-only";

const API = "https://www.googleapis.com/drive/v3";

// Drive rides on the Google account's granted scopes. Available once any Drive
// scope is present (we request drive.readonly).
export function driveConnected(scope: string | null | undefined): boolean {
  return (scope ?? "").includes("/auth/drive");
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  thumbnailLink?: string;
  hasThumbnail: boolean;
  modifiedTime: string;
  modifiedMs: number;
  size: number; // 0 for Google-native docs (no direct size)
  isGoogleDoc: boolean;
};

// Google-native files have no downloadable bytes; they must be exported to a
// concrete format. Map the common ones to a sensible export type, and record the
// extension so the imported asset has a real filename.
const GOOGLE_EXPORT: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "image/png",
    ext: "png",
  },
};

function isGoogleApps(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps");
}

async function driveGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// Searches the user's Drive by filename. An empty query returns recent files to
// browse. Folders are excluded; trashed files are excluded. Shared drives are
// included.
export async function searchDriveFiles(
  token: string,
  query: string,
  max = 25
): Promise<DriveFile[]> {
  const q = query.trim().replace(/'/g, "\\'");
  const clauses = [
    "trashed = false",
    "mimeType != 'application/vnd.google-apps.folder'",
  ];
  if (q) clauses.push(`name contains '${q}'`);

  const params = new URLSearchParams({
    q: clauses.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize: String(max),
    fields:
      "files(id,name,mimeType,iconLink,thumbnailLink,hasThumbnail,modifiedTime,size)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });

  const data = await driveGet<{
    files?: {
      id?: string;
      name?: string;
      mimeType?: string;
      iconLink?: string;
      thumbnailLink?: string;
      hasThumbnail?: boolean;
      modifiedTime?: string;
      size?: string;
    }[];
  }>(token, `files?${params.toString()}`);

  return (data.files ?? [])
    .filter((f) => f.id && f.name)
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType || "application/octet-stream",
      iconLink: f.iconLink,
      thumbnailLink: f.thumbnailLink,
      hasThumbnail: Boolean(f.hasThumbnail && f.thumbnailLink),
      modifiedTime: f.modifiedTime || "",
      modifiedMs: f.modifiedTime ? Date.parse(f.modifiedTime) : 0,
      size: f.size ? Number(f.size) : 0,
      isGoogleDoc: isGoogleApps(f.mimeType || ""),
    }));
}

export type DriveDownload = {
  bytes: Buffer;
  filename: string;
  mimeType: string;
};

// Downloads a Drive file's bytes. Google-native docs are exported to an Office
// or image format; everything else is fetched directly (alt=media). The returned
// filename gets an extension for exported docs so the stored asset opens cleanly.
export async function getDriveFileBytes(
  token: string,
  fileId: string,
  name: string,
  mimeType: string
): Promise<DriveDownload> {
  let url: string;
  let outMime = mimeType || "application/octet-stream";
  let filename = name;

  if (isGoogleApps(mimeType)) {
    const exp = GOOGLE_EXPORT[mimeType] ?? {
      mimeType: "application/pdf",
      ext: "pdf",
    };
    outMime = exp.mimeType;
    if (!new RegExp(`\\.${exp.ext}$`, "i").test(filename)) {
      filename = `${filename}.${exp.ext}`;
    }
    url = `${API}/files/${fileId}/export?mimeType=${encodeURIComponent(
      exp.mimeType
    )}`;
  } else {
    url = `${API}/files/${fileId}?alt=media&supportsAllDrives=true`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Drive download ${res.status}: ${await res.text()}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, filename, mimeType: outMime };
}
