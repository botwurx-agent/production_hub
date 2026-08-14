import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";
import { ProductionCover } from "@/components/production/production-cover";
import type { ShotBoard } from "@/lib/database.types";

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

/** A labelled caption line, matching how the shot list labels its columns. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-text-faint">
        {label}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-snug text-text">
        {value}
      </p>
    </div>
  );
}

// Present / export view for storyboards: a clean, print-ready frame grid per
// storyboard (mirrors the shot list's Present / Export).
export default async function StoryboardPresentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { board?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The job block, from the SAME row the shot list export reads. Filling it in
  // once is what makes this document arrive dressed rather than plain.
  const { data: shotBoard } = await supabase
    .from("shot_boards")
    .select("*")
    .eq("project_id", params.id)
    .maybeSingle();

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
      {searchParams?.auto ? <AutoPrint /> : null}
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

      <ProductionCover
        board={(shotBoard ?? null) as ShotBoard | null}
        studioName={ctx.studio.name}
        clientName={clientName}
        logoUrl={logoUrl}
        title={shotBoard?.title?.trim() || project.title}
        subtitle={shotBoard?.subtitle}
        overline="Storyboard"
      />

      {/* Forced light under the dark cover, matching the shot list export. Without
          it a producer working in dark mode prints white type on white paper. */}
      <div data-theme="light" className="mt-6">
      {visibleBoards.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">No storyboards yet.</p>
      ) : (
        visibleBoards.map((board, bi) => {
          const bframes = frames.filter((f) => f.board_id === board.id);
          return (
            <section key={board.id} className="mb-10 break-inside-avoid">
              {/* Titled the way the shot list titles a list: a numbered chip
                  and a real heading, rather than a small bold line. */}
              {visibleBoards.length > 1 && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span
                    style={printExact}
                    className="rounded-[8px] bg-text px-2.5 py-1 text-xs font-bold text-bg"
                  >
                    {String(bi + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-text">
                    {board.name?.trim() || "Storyboard"}
                  </h2>
                  <span className="ml-auto text-xs font-bold uppercase tracking-widest text-text-faint">
                    {bframes.length} frame{bframes.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
              {bframes.length === 0 ? (
                <p className="text-sm text-text-faint">No frames in this storyboard.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
                  {bframes.map((f, i) => (
                    <div
                      key={f.id}
                      className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-surface print:break-inside-avoid"
                    >
                      <div className="relative">
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
                        {/* The frame number sits ON the picture, the way a
                            board numbers its panels, so the caption block
                            below is all content. */}
                        <span
                          style={printExact}
                          className="absolute left-2 top-2 rounded-[7px] bg-black/70 px-2 py-0.5 text-[11px] font-extrabold text-white"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        {f.scene?.trim() && (
                          <p className="text-[12.5px] font-bold text-text">{f.scene}</p>
                        )}
                        {f.description?.trim() && (
                          <Line label="Shot" value={f.description} />
                        )}
                        {f.sound?.trim() && <Line label="Sound" value={f.sound} />}
                        {f.notes?.trim() && <Line label="Motion" value={f.notes} />}
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
    </div>
  );
}
