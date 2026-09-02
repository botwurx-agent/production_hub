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
import { DayDivider } from "@/components/production/day-divider";
import { ShotTile } from "@/components/production/shot-tile";
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
              <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-text">
                  {g.title || "Untitled shot list"}
                </h2>
                <span className="pb-1 text-[11px] font-bold uppercase tracking-widest text-text-faint">
                  {g.subtitle?.trim() ? `${g.subtitle} · ` : ""}
                  {groupCards.length} {groupCards.length === 1 ? "shot" : "shots"}
                </span>
              </div>
              {g.description?.trim() && (
                <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-text-muted">
                  {g.description}
                </p>
              )}

              {/* DAYS BREAK THE PAGE. A two-day shoot goes out as one document
                  with a hard break before each new day, so nobody on set has
                  to work out where Thursday ends. `break-before-page` is the
                  print rule; on screen the same header just reads as a
                  section. Only when there IS a second day: a lone "Day 1"
                  banner on a one-day shoot is noise, and a page break before
                  it would be a blank sheet. */}
              {dayGroups.map((d, di) => {
              // The running number of the FIRST shot in this day, so a day's
              // shots can be named even when nobody typed a code.
              const dayStart = running + 1;
              return (
              <div key={d.key} className={showDays && di > 0 ? "break-before-page pt-6" : ""}>
              {showDays && (
                <div className="mb-6">
                  <DayDivider
                    label={d.label}
                    overline={overline || b?.location?.trim() || "Shoot schedule"}
                    shots={d.shots.map((c, i) => ({ code: c.code, n: dayStart + i }))}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-3">
                {d.shots.map((c) => {
                  running += 1;
                  return (
                    <ShotTile
                      key={c.id}
                      shot={c}
                      n={running}
                      imageUrl={c.signedUrl}
                      dayLabel={showDays ? d.label : null}
                    />
                  );
                })}
              </div>
              </div>
              );
              })}
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
