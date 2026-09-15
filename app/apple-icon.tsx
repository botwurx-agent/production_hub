import { ImageResponse } from "next/og";
import { TileCss } from "@/lib/brand-mark-css";

/**
 * The home-screen icon. Apple does not round these itself and does not honour
 * transparency, so the mark is drawn edge to edge on its own ground (rounded
 * false) and iOS applies the squircle.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <TileCss size={180} bg="#5662eb" fg="#ffffff" rounded={false} />,
    size,
  );
}
