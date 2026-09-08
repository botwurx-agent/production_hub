import { FEATURES, countWord } from "@/lib/marketing/features";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing/og";

export const alt = "Everything Studio Flows does, one page per feature";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "Features",
    title: "Everything it takes to run the job.",
    body: `One spine, ${countWord(FEATURES.length)} pieces. Each stands on its own, and every one gets stronger because the others are in the same place.`,
    hue: "purple",
  });
}
