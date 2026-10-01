// The producer's-journey Reel (components/marketing/journey-video.tsx),
// previewed and rendered the same way as /dev/brand-video.
// Auth-gated in production by /dev/*. ?capture=1 renders, ?t=<ms> freezes.
import { BrandVideoPlayer } from "@/components/marketing/brand-video-player";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { capture?: string; t?: string } }) {
  const fixed = searchParams.t !== undefined && Number.isFinite(Number(searchParams.t)) ? Number(searchParams.t) : null;
  return <BrandVideoPlayer film="journey" capture={searchParams.capture === "1"} fixed={fixed} />;
}
