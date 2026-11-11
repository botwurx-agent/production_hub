// The 16:9 product tour film, previewed and rendered from one composition
// (components/marketing/tour-film.tsx) over footage captured by
// scripts/film/capture-tour.mjs. Auth-gated in production by /dev/*.
// ?capture=1 is the render harness, ?t=<ms> freezes a frame.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TourFilmPlayer } from "@/components/marketing/tour-film-player";
import type { Takes } from "@/components/marketing/tour-kit";

export const dynamic = "force-dynamic";

/**
 * The takes' manifests are read here, on the server, rather than fetched by
 * the page: the middleware only lets image extensions through without a
 * session, so a fetched .json comes back as the login page.
 */
function loadTakes(): Takes {
  const out: Takes = {};
  const root = join(process.cwd(), "public", "film-src");
  let names: string[] = [];
  try {
    names = readdirSync(root);
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      out[name] = JSON.parse(readFileSync(join(root, name, "take.json"), "utf8"));
    } catch {
      // Not a take (the stills folder), or not captured yet.
    }
  }
  return out;
}

export default function Page({ searchParams }: { searchParams: { capture?: string; t?: string } }) {
  const fixed = searchParams.t !== undefined && Number.isFinite(Number(searchParams.t)) ? Number(searchParams.t) : null;
  return <TourFilmPlayer capture={searchParams.capture === "1"} fixed={fixed} takes={loadTakes()} />;
}
