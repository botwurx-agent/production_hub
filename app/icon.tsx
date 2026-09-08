import { ImageResponse } from "next/og";

/**
 * The browser tab icon, for the app and the marketing site alike. There was no
 * favicon of any kind, so every tab and every bookmark showed a blank sheet,
 * which is the one piece of branding a person sees on every single visit.
 *
 * Generated rather than drawn so it cannot drift from the wordmark: this is the
 * same SF mark the nav and the sidebar render, at the same indigo. `--accent`
 * is oklch in the tokens and Satori cannot read that, so the hex here is a
 * converted value, same as lib/marketing/og.tsx.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#5662eb",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: -0.5,
          borderRadius: 7,
          fontFamily: "sans-serif",
        }}
      >
        SF
      </div>
    ),
    size,
  );
}
