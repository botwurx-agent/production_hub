import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing/og";

export const alt = "Studio Flows pricing: the whole toolkit on every plan";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "Pricing",
    title: "The whole toolkit, on every plan.",
    body: "Free forever for one real job, start to finish. Clients reviewing work and crew on a single project are unlimited and free on every tier.",
    hue: "green",
  });
}
