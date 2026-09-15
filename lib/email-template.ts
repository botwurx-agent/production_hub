import "server-only";
import {
  MARK_BARS,
  MARK_BOX,
  MARK_RADIUS,
  MARK_SCALE,
  MARK_STROKE,
} from "@/lib/brand-mark";

// Minimal, brand-consistent transactional email layout. Email clients strip
// <style> and CSS variables, so everything is inline and colors are literal.
// All caller-supplied text is HTML-escaped here.

const ACCENT = "#4f46e5"; // indigo, matches the app's default accent

/**
 * The brand mark for an email, built as three stacked blocks rather than as the
 * SVG every other surface uses. Gmail strips inline SVG entirely and Outlook's
 * Word engine ignores absolute positioning, so the one surface a new user meets
 * first is the one that cannot use either. A hosted PNG was the other option and
 * is worse: images are blocked by default in plenty of clients, where this
 * always renders.
 *
 * It reads MARK_STROKES, so it cannot drift from the favicon or the nav chip.
 * Stacked blocks with top margins need no positioning at all, and the bars do
 * not overlap vertically (the strokes sit 9 grid units apart), so this is an
 * exact layout rather than an approximation. Worst case, in a client that drops
 * border-radius, the caps go square and it still reads as the mark.
 */
function markHtml(tile: number): string {
  const scale = (tile * MARK_SCALE) / MARK_BOX;
  const inset = (tile - tile * MARK_SCALE) / 2;
  const px = (units: number) => Math.round(units * scale);
  const h = px(MARK_STROKE);
  let cursor = 0; // the bottom edge of what has been laid out so far
  const bars = MARK_BARS.map((bar) => {
    const top = Math.round(inset + bar.top * scale);
    const gap = Math.max(0, top - cursor);
    cursor = top + h;
    return (
      `<div style="margin:${gap}px 0 0 ${Math.round(inset + bar.left * scale)}px;` +
      `width:${px(bar.width)}px;height:${h}px;background:#ffffff;` +
      `border-radius:${h}px;font-size:0;line-height:0;">&nbsp;</div>`
    );
  }).join("");
  return (
    `<span style="display:inline-block;vertical-align:middle;width:${tile}px;` +
    `height:${tile}px;background:${ACCENT};` +
    `border-radius:${Math.round(tile * MARK_RADIUS)}px;margin-right:9px;">` +
    `${bars}</span>`
  );
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  heading: string;
  // Body paragraphs (plain strings, escaped here).
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
};

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const lines = c.lines
    .map(
      (l) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f4650;">${escapeHtml(
          l
        )}</p>`
    )
    .join("");

  const cta =
    c.ctaLabel && c.ctaUrl
      ? `<div style="margin:24px 0;">
           <a href="${escapeHtml(c.ctaUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:11px;">${escapeHtml(
             c.ctaLabel
           )}</a>
         </div>
         <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#99a1ad;word-break:break-all;">Or paste this link: ${escapeHtml(
           c.ctaUrl
         )}</p>`
      : "";

  const footnote = c.footnote
    ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#99a1ad;">${escapeHtml(
        c.footnote
      )}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="margin-bottom:20px;font-weight:800;font-size:18px;color:#1a1c1f;letter-spacing:-0.3px;">
        ${markHtml(34)}<span style="vertical-align:middle;">Studio Flows</span>
      </div>
      <div style="background:#ffffff;border:1px solid #e4e6ea;border-radius:16px;padding:26px 24px;">
        <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1a1c1f;">${escapeHtml(
          c.heading
        )}</h1>
        ${lines}
        ${cta}
        ${footnote}
      </div>
      <p style="margin:16px 4px 0;font-size:11px;color:#aeb4bd;">Sent by Studio Flows.</p>
    </div>
  </body>
</html>`;

  const textParts = [
    c.heading,
    "",
    ...c.lines,
    c.ctaUrl ? `\n${c.ctaLabel ?? "Open"}: ${c.ctaUrl}` : "",
    c.footnote ? `\n${c.footnote}` : "",
    "\nSent by Studio Flows.",
  ];
  const text = textParts.filter((p) => p !== undefined).join("\n");

  return { html, text };
}
