import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";

const SIGNED_TTL = 60 * 60;
const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

type Frame = {
  id: string;
  board_id: string;
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
  signedUrl: string | null;
};

// Present / export view for storyboards: a clean, print-ready frame grid per
// storyboard (mirrors the shot list's Present / Export).
export default async function StoryboardPresentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { board?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: boardRows } = await supabase
    .from("boards")
    .select("id, name")
    .eq("project_id", params.id)
    .eq("kind", "storyboard")
    .order("position", { ascending: true });
  const boards = (boardRows ?? []) as { id: string; name: string }[];
  const boardIds = boards.map((b) => b.id);

  let frames: Frame[] = [];
  if (boardIds.length > 0) {
    const { data: frameRows } = await supabase
      .from("storyboard_frames")
      .select("*")
      .in("board_id", boardIds)
      .order("position", { ascending: true });
    const paths = (frameRows ?? [])
      .map((f) => f.storage_path)
      .filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: list } = await assetStorage()
        .createSignedUrls(paths, SIGNED_TTL);
      for (const s of list ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
    frames = (frameRows ?? []).map((f) => ({
      id: f.id,
      board_id: f.board_id,
      scene: f.scene,
      description: f.description,
      sound: f.sound,
      notes: f.notes,
      signedUrl: f.storage_path ? (signed.get(f.storage_path) ?? null) : null,
    }));
  }

  const selected =
    searchParams?.board && searchParams.board !== "all" ? searchParams.board : null;
  const visibleBoards = selected ? boards.filter((b) => b.id === selected) : boards;

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);
  const clientName = (project.client as { name: string } | null)?.name || "";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/storyboards`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to storyboards
        </Link>
        <PrintButton />
      </div>

      {boards.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-text-faint">
            Export
          </span>
          <Link
            href={`/projects/${project.id}/storyboards/present`}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
              !selected
                ? "bg-accent-soft text-accent"
                : "border border-border text-text-muted hover:text-text"
            }`}
          >
            All storyboards
          </Link>
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/projects/${project.id}/storyboards/present?board=${b.id}`}
              className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
                selected === b.id
                  ? "bg-accent-soft text-accent"
                  : "border border-border text-text-muted hover:text-text"
              }`}
            >
              {b.name?.trim() || "Untitled"}
            </Link>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          {logoUrl && (
            <span
              style={printExact}
              className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={ctx.studio.name} className="h-full w-full object-contain p-1" />
            </span>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
              {ctx.studio.name}
              {clientName ? ` · ${clientName}` : ""}
            </p>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-text">
              {project.title} — Storyboard
            </h1>
          </div>
        </div>
      </div>

      {visibleBoards.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">No storyboards yet.</p>
      ) : (
        visibleBoards.map((board) => {
          const bframes = frames.filter((f) => f.board_id === board.id);
          return (
            <section key={board.id} className="mb-8">
              {visibleBoards.length > 1 && (
                <h2 className="mb-3 font-display text-base font-bold text-text">{board.name}</h2>
              )}
              {bframes.length === 0 ? (
                <p className="text-sm text-text-faint">No frames in this storyboard.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
                  {bframes.map((f, i) => (
                    <div
                      key={f.id}
                      className="overflow-hidden rounded-[12px] border border-border bg-surface print:break-inside-avoid"
                    >
                      <div
                        style={printExact}
                        className="grid aspect-video place-items-center overflow-hidden bg-surface-2"
                      >
                        {f.signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.signedUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-text-faint">No image</span>
                        )}
                      </div>
                      <div className="space-y-1 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-text">Frame {i + 1}</span>
                          {f.scene?.trim() && (
                            <span className="text-[11px] font-semibold text-text-muted">
                              {f.scene}
                            </span>
                          )}
                        </div>
                        {f.description?.trim() && (
                          <p className="text-xs text-text-muted">{f.description}</p>
                        )}
                        {f.sound?.trim() && (
                          <p className="text-[11px] text-text-faint">Sound: {f.sound}</p>
                        )}
                        {f.notes?.trim() && (
                          <p className="text-[11px] text-text-faint">Motion: {f.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
