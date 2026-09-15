import { ImageResponse } from "next/og";
import { TileCss } from "@/lib/brand-mark-css";

/**
 * The browser tab icon, for the app and the marketing site alike. There was no
 * favicon of any kind, so every tab and every bookmark showed a blank sheet,
 * which is the one piece of branding a person sees on every single visit.
 *
 * Generated rather than drawn so it cannot drift from the wordmark: it reads the
 * same geometry the nav chip and the sidebar render. `--accent` is oklch in the
 * tokens and Satori cannot read that, so the hex here is a converted value,
 * same as lib/marketing/og.tsx.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<TileCss size={32} bg="#5662eb" fg="#ffffff" />, size);
}
