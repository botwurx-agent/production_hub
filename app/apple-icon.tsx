import { ImageResponse } from "next/og";

/**
 * The home-screen icon. Apple does not round these itself and does not honour
 * transparency, so the mark is drawn edge to edge on its own ground and iOS
 * applies the squircle.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: -3,
          fontFamily: "sans-serif",
        }}
      >
        SF
      </div>
    ),
    size,
  );
}
