import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing/og";

export const alt = "Contact Studio Flows: talk to the person who built it";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    eyebrow: "Contact",
    title: "Talk to the person who built it.",
    body: "Studio Flows is made by a working commercial production studio. Messages come to us, not to a support queue.",
    hue: "indigo",
  });
}
