import "server-only";
import { reportError } from "@/lib/log";

// Transactional email via Resend's HTTP API (no SDK dependency). Everything is
// gated on RESEND_API_KEY + EMAIL_FROM, so the app runs fine un-configured and
// callers can check emailConfigured() to decide whether to offer a send.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult = { ok: boolean; error?: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email is not set up yet." };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      reportError("sendEmail", `Resend ${res.status}: ${body.slice(0, 300)}`);
      return { ok: false, error: "The email could not be sent. Try again." };
    }
    return { ok: true };
  } catch (e) {
    reportError("sendEmail", e);
    return { ok: false, error: "The email could not be sent. Try again." };
  }
}
