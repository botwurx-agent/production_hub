import Link from "next/link";
import { groupByDay, hasDays } from "@/lib/shot-days";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";
import { ProductionCover } from "@/components/production/production-cover";
import type {
  ShotBoard,
  ShotGroup,
  ShotCard,
} from "@/lib/database.types";

const SIGNED_TTL = 60 * 60;
// Force important backgrounds/gradients to render when printing to PDF.
const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

export default async function ShotBoardViewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { list?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: board }, { data: groups }] = await Promise.all([
    supabase.from("shot_boards").select("*").eq("project_id", params.id).maybeSingle(),
    supabase
      .from("shot_groups")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
  ]);
  const b = board as ShotBoard | null;

  const groupList = (groups ?? []) as ShotGroup[];
  const groupIds = groupList.map((g) => g.id);
  let cards: (ShotCard & { signedUrl: string | null })[] = [];
  if (groupIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("shot_cards")
      .select("*")
      .in("group_id", groupIds)
      .order("position", { ascending: true });
    const paths = (cardRows ?? [])
      .map((c) => c.storage_path)
      .filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: list } = await assetStorage()
        .createSignedUrls(paths, SIGNED_TTL);
      for (const s of list ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
    cards = (cardRows ?? []).map((c) => ({
      ...(c as ShotCard),
      signedUrl: c.storage_path ? (signed.get(c.storage_path) ?? null) : null,
    }));
  }

  // Which lists to present: a specific one via ?list=<id>, or all by default.
  const selectedList =
    searchParams?.list && searchParams.list !== "all" ? searchParams.list : null;
  const visibleGroups = selectedList
    ? groupList.filter((g) => g.id === selectedList)
    : groupList;

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);
  const title = b?.title?.trim() || project.title;
  const clientName =
    b?.client?.trim() || (project.client as { name: string } | null)?.name || "";
  const overline = [b?.client?.trim(), b?.agency?.trim()].filter(Boolean).join(" × ");

  let running = 0;

  return (
    <div className="mx-auto max-w-5xl">
      {searchParams?.auto ? <AutoPrint /> : null}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/shot-list`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to shot list
        </Link>
        <PrintButton />
      </div>

      {/* List selector: present all, or a single shot list. */}
      {groupList.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-text-faint">
            Export
          </span>
          <Link
            href={`/projects/${project.id}/production/board`}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
              !selectedList
                ? "bg-accent-soft text-accent"
                : "border border-border text-text-muted hover:text-text"
            }`}
          >
            All lists
          </Link>
          {groupList.map((g) => (
            <Link
              key={g.id}
              href={`/projects/${project.id}/production/board?list=${g.id}`}
              className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
                selectedList === g.id
                  ? "bg-accent-soft text-accent"
                  : "border border-border text-text-muted hover:text-text"
              }`}
            >
              {g.title?.trim() || "Untitled list"}
            </Link>
          ))}
        </div>
      )}

      {/* Cover. Shared with the storyboard export so a job states its facts
          the same way whatever document leaves the studio. */}
      <ProductionCover
        board={b ?? null}
        studioName={ctx.studio.name}
        clientName={clientName}
        logoUrl={logoUrl}
        title={title}
        subtitle={b?.subtitle}
        overline={overline}
      />

      {/* Shots (light) */}
      <div data-theme="light" className="mt-6 space-y-10">
        {visibleGroups.map((g, gi) => {
          const groupCards = cards.filter((c) => c.group_id === g.id);
          const dayGroups = groupByDay(groupCards);
          const showDays = hasDays(dayGroups);
          // `break-inside-avoid` keeps a shot together on one page, but it
          // contradicts a child asking for a page break, so it is dropped when
          // the days are doing the breaking.
          return (
            <section key={g.id} className={showDays ? undefined : "break-inside-avoid"}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    style={printExact}
                    className="rounded-[8px] bg-text px-2.5 py-1 text-xs font-bold text-bg"
                  >
                    Shot {String(gi + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-text">
                    {g.title || "Untitled shot"}
                  </h2>
                </div>
                {g.subtitle?.trim() && (
                  <span className="text-xs font-bold uppercase tracking-widest text-text-faint">
                    {g.subtitle}
                  </span>
                )}
              </div>
              {g.description?.trim() && (
                <p className="mb-4 max-w-3xl text-sm text-text-muted">{g.description}</p>
              )}

              {/* DAYS BREAK THE PAGE. A two-day shoot goes out as one document
                  with a hard break before each new day, so nobody on set has
                  to work out where Thursday ends. `break-before-page` is the
                  print rule; on screen the same header just reads as a
                  section. Only when there IS a second day: a lone "Day 1"
                  banner on a one-day shoot is noise, and a page break before
                  it would be a blank sheet. */}
              {dayGroups.map((d, di) => (
              <div key={d.key} className={showDays && di > 0 ? "break-before-page pt-6" : ""}>
              {showDays && (
                <div className="mb-3 flex items-center gap-3">
                  <span
                    style={printExact}
                    className="rounded-[8px] bg-text px-2.5 py-1 text-xs font-bold text-bg"
                  >
                    {d.label}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-text-faint">
                    {d.shots.length} {d.shots.length === 1 ? "shot" : "shots"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {d.shots.map((c) => {
                  running += 1;
                  return (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm"
                    >
                      <div
                        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-2/60"
                        style={printExact}
                      >
                        {c.signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.signedUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-text-faint">
                            No image
                          </span>
                        )}
                        {c.code?.trim() && (
                          <span
                            style={printExact}
                            className="absolute left-2 top-2 rounded-[7px] bg-surface px-2 py-0.5 text-xs font-bold text-text"
                          >
                            {c.code}
                          </span>
                        )}
                        {c.day?.trim() && (
                          <span
                            style={printExact}
                            className="absolute right-2 top-2 rounded-pill bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white"
                          >
                            {c.day}
                          </span>
                        )}
                        <span
                          style={printExact}
                          className="absolute bottom-2 right-2 rounded-[7px] bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white"
                        >
                          {String(running).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="space-y-2 p-3">
                        {c.description?.trim() && (
                          <p className="text-sm text-text">{c.description}</p>
                        )}
                        {(c.vo?.trim() || c.notes?.trim() || (Array.isArray(c.tags) && c.tags.length > 0)) && (
                          <div className="border-t border-border pt-2">
                            {c.vo?.trim() && (
                              <p className="text-xs text-text-muted">
                                <span className="font-bold uppercase tracking-wide text-text-faint">
                                  VO / OST{" "}
                                </span>
                                {c.vo}
                              </p>
                            )}
                            {c.notes?.trim() && (
                              <p className="mt-1 text-xs text-text-muted">
                                <span className="font-bold uppercase tracking-wide text-text-faint">
                                  Notes{" "}
                                </span>
                                {c.notes}
                              </p>
                            )}
                            {Array.isArray(c.tags) && c.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(c.tags as string[]).map((t, i) => (
                                  <span
                                    key={i}
                                    style={printExact}
                                    className="rounded-[6px] bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-muted"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              ))}
            </section>
          );
        })}

        {visibleGroups.length === 0 && (
          <p className="py-12 text-center text-sm text-text-faint">
            Nothing to show. Add shots on the shot list, then present them here.
          </p>
        )}
      </div>
    </div>
  );
}
