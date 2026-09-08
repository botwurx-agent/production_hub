import { ImageResponse } from "next/og";

/**
 * The social card every marketing page hands to Slack, iMessage, LinkedIn and
 * the rest.
 *
 * WHY IT IS GENERATED rather than a designed PNG per page: there are seventeen
 * public pages and a card has to carry that page's own words, or every share
 * looks identical and the link tells the reader nothing about where it goes.
 * Generating them from the SAME data the pages render (lib/marketing/features)
 * means a page cannot ship with a card describing something else.
 *
 * TWO CONSTRAINTS SHAPED THE DESIGN, and both are worth knowing before editing.
 *
 * SATORI CANNOT PARSE oklch(), and the entire product palette is written in it,
 * so the colors below are exact sRGB conversions of the light-theme tokens
 * rather than approximations picked by eye. Regenerate them the same way if a
 * token moves: convert oklch -> oklab -> linear sRGB -> sRGB, do not sample a
 * screenshot. The pairs here are the `--h-<hue>` and `--h-<hue>-bg` values from
 * app/globals.css, which is why a card's wash matches the page's own hue.
 *
 * SATORI ALSO NEEDS A REAL FONT FILE, and ours are Google-hosted through
 * next/font, which self-hosts them as woff2. Satori reads ttf, otf and woff,
 * never woff2, so the brand face is not available here. Fetching the ttf at
 * generation time was rejected deliberately: it turns every deploy into a
 * request against a third party, and a failure there is a failed BUILD rather
 * than a slightly plain card. So these render on the bundled default face and
 * carry the brand through palette, mark, structure and the real copy. To use
 * Plus Jakarta Sans properly, commit its .ttf into the repo and read it off
 * disk here, which keeps the build hermetic.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Light-theme tokens, converted from oklch. See the note above. */
const C = {
  bg: "#fafafe",
  surface: "#ffffff",
  text: "#202133",
  textMuted: "#66677a",
  textFaint: "#8f91a2",
  border: "#e3e4ec",
  accent: "#5662eb",
  accentFg: "#ffffff",
};

/** `--h-<hue>` and `--h-<hue>-bg`, in the same order the pages use them. */
const HUES: Record<string, [string, string]> = {
  indigo: ["#5662eb", "#e4edff"],
  purple: ["#923ada", "#f7e6ff"],
  blue: ["#0088df", "#cff2ff"],
  cyan: ["#00adc4", "#c0faff"],
  green: ["#00b16b", "#bbfdd6"],
  amber: ["#ed9c0a", "#ffe7b8"],
  orange: ["#f57717", "#ffe2c5"],
  pink: ["#ef409f", "#ffdff3"],
  red: ["#f13044", "#ffdfdc"],
};

function hue(name: string): [string, string] {
  return HUES[name] ?? HUES.indigo;
}

/**
 * Trims to a whole word and adds an ellipsis.
 *
 * Satori has no line clamping and no text-overflow, so an over-long line does
 * not truncate, it pushes the card's own footer off the bottom edge. Clamping
 * in JS is the only thing that actually bounds the layout.
 */
function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = cut.lastIndexOf(" ");
  return `${cut.slice(0, stop > max * 0.6 ? stop : max).trimEnd()}...`;
}

/**
 * As many whole sentences as fit, rather than a hard cut.
 *
 * The ledes these cards draw from run to three sentences, and a character
 * clamp lands mid-clause ("Pin lunch..."), which reads as a truncated database
 * field rather than as a sentence. Ending on a full stop is the difference
 * between a card that looks written and one that looks generated. Falls back
 * to the word clamp when even the first sentence is too long.
 */
function sentences(text: string, max: number): string {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!parts) return clamp(text, max);
  let out = "";
  for (const part of parts) {
    if (out && (out + part).trim().length > max) break;
    out += part;
  }
  return out.trim() || clamp(parts[0], max);
}

/**
 * Stops a hyphenated word breaking across lines.
 *
 * A hyphen is a legal break point, so "The day re-flows." wrapped as "re-" and
 * then "flows.", which reads as a typesetting accident rather than a headline.
 * U+2011 is the non-breaking hyphen and looks identical. Only hyphens BETWEEN
 * LETTERS are swapped, so a dash used as punctuation still breaks normally.
 */
function noBreakHyphens(s: string): string {
  return s.replace(/(\p{L})-(\p{L})/gu, "$1\u2011$2");
}

export type OgCard = {
  /** Small tracked line above the headline: the keyword, or the section. */
  eyebrow: string;
  /** The headline. Kept to the page's own h1 wherever there is one. */
  title: string;
  /** One supporting line, clamped. */
  body: string;
  /** Identity hue, matching the page. */
  hue?: string;
};

export function ogCard({ eyebrow, title, body, hue: hueName = "indigo" }: OgCard) {
  const [ink, wash] = hue(hueName);
  // Tiered rather than a formula, so a long headline steps down to a size that
  // still reads at thumbnail scale instead of shrinking continuously into
  // illegibility. The measure below is wide enough that a two-word tail does
  // not get pushed onto its own line.
  const titleSize = title.length <= 26 ? 84 : title.length <= 42 ? 70 : title.length <= 58 ? 58 : 50;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: C.bg,
          // The page's own hue, held to a corner. Staging, not a paint bucket:
          // the same rule section 4.6 applies to a product visual's canvas.
          //
          // `circle at <position>` is the ONLY radial form Satori parses. The
          // CSS two-value size (`1100px 620px at 100% 0%`) is valid in a
          // browser and throws "Missing comma before color stops" here, which
          // surfaces as a 500 on the image route and a share with no picture.
          backgroundImage: `radial-gradient(circle at 100% 0%, ${wash}, ${C.bg} 62%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* A rule of the page hue along the top, so a card is identifiable as
            this page's before a word of it is read.

            A FLEX CHILD, NOT position:absolute. Satori resolves an absolute
            inset against the PADDING box, so `left: 0; width: 100%` on a
            padded parent drew the rule 140px short of the right edge and it
            read as a broken element. The padding now lives on the inner
            column, which leaves this free to span the full width by itself. */}
        <div style={{ display: "flex", height: 10, backgroundColor: ink }} />

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 72px 46px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                backgroundColor: C.accent,
                color: C.accentFg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 25,
                fontWeight: 800,
                letterSpacing: -0.5,
              }}
            >
              SF
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.text, letterSpacing: -0.6 }}>
              Studio Flows
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 3.2,
                textTransform: "uppercase",
                color: ink,
                marginBottom: 20,
              }}
            >
              {clamp(eyebrow, 42)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2,
                color: C.text,
                maxWidth: 1056,
              }}
            >
              {noBreakHyphens(clamp(title, 84))}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                lineHeight: 1.42,
                color: C.textMuted,
                marginTop: 24,
                maxWidth: 980,
              }}
            >
              {sentences(body, 150)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `2px solid ${C.border}`,
              paddingTop: 24,
            }}
          >
            <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: C.textFaint }}>
              studio-flows.com
            </div>
            <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: C.textMuted }}>
              The production hub for commercial studios
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
