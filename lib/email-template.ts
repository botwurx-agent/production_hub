import "server-only";

// Minimal, brand-consistent transactional email layout. Email clients strip
// <style> and CSS variables, so everything is inline and colors are literal.
// All caller-supplied text is HTML-escaped here.

const ACCENT = "#4f46e5"; // indigo, matches the app's default accent

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
        <span style="display:inline-block;background:${ACCENT};color:#fff;border-radius:8px;padding:3px 7px;font-size:13px;margin-right:8px;">SF</span>Studio Flows
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
