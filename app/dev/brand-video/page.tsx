// The Instagram launch video, previewed and rendered from one composition
// (components/marketing/brand-video.tsx). Auth-gated in production by /dev/*.
// ?capture=1 is the render harness, ?t=<ms> freezes a frame.
import { BrandVideoPlayer } from "@/components/marketing/brand-video-player";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { capture?: string; t?: string } }) {
  const fixed = searchParams.t !== undefined && Number.isFinite(Number(searchParams.t)) ? Number(searchParams.t) : null;
  return <BrandVideoPlayer capture={searchParams.capture === "1"} fixed={fixed} />;
}
