# Branding the Supabase Auth emails

Studio Flows sends two kinds of email, and only one of them is ours.

**Ours (already branded).** Invites, review requests, call sheets, billing
documents, reminders. These go through Resend from `lib/email.ts` and are laid
out by `lib/email-template.ts`, so they already carry the SF mark, the indigo
accent, and a "Sent by Studio Flows" footer.

**Supabase's (not branded by default).** Signup confirmation, password reset,
email-change confirmation. These are generated inside Supabase Auth, sent from
Supabase's shared SMTP, and arrive from an address like
`noreply@mail.app.supabase.io` with a subject such as "Confirm Your Signup".
Nothing in this repository controls them.

Two of those are already live today: `/forgot-password` calls
`resetPasswordForEmail`, and the login page can call `resend()`. So the
unbranded sender is a live issue whether or not "Confirm email" is switched on.

Fixing it takes three settings changes in the Supabase dashboard. No code.

---

## 1. Point Supabase Auth at Resend (Custom SMTP)

Dashboard: **Authentication → Emails → SMTP Settings → Enable Custom SMTP**.

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the same Resend API key as `RESEND_API_KEY` in Vercel |
| Sender email | the same address as `EMAIL_FROM`, for example `hello@studio-flows.com` |
| Sender name | `Studio Flows` |

**Prerequisite, and the one thing that can block this:** Resend only sends from
a verified domain. A Gmail address cannot be a sender. If `EMAIL_FROM` is
already set in Vercel and app invites are arriving, the domain is verified and
this step is a five-minute change. If it is not, verify `studio-flows.com` in
Resend first (three DNS records) and set `EMAIL_FROM` to an address on it.
`studioflows1@gmail.com` stays fine as the contact address in the legal pages
and as a reply-to; it just cannot be the sender.

While on this screen, check **Authentication → Rate Limits → Email sent**.
Supabase's shared SMTP is capped low on purpose (a handful per hour, which is
its own reason not to run a beta on it). Custom SMTP starts at 30 per hour and
can be raised.

## 2. Replace the templates

Dashboard: **Authentication → Emails → Templates**. Three templates can fire.
Paste the HTML below into each. It is the same layout as
`lib/email-template.ts`, hand-inlined, since Supabase renders a raw string and
cannot import from this codebase. If the app's email design changes, these
have to be updated by hand; that duplication is the price of Supabase owning
the auth mail.

Every link points at **our** `/auth/confirm` route with `token_hash` + `type`,
not at the Supabase verify endpoint. That matters for branding: the URL the
recipient hovers reads `studio-flows.com`, not `<project-ref>.supabase.co`.
The route already accepts exactly these parameters.

`{{ .SiteURL }}` comes from **Authentication → URL Configuration → Site URL**,
so set that to the production origin before pasting these in.

### Confirm signup

Subject: `Confirm your Studio Flows account`

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="margin-bottom:20px;font-weight:800;font-size:18px;color:#1a1c1f;letter-spacing:-0.3px;">
        <span style="display:inline-block;background:#4f46e5;color:#fff;border-radius:8px;padding:3px 7px;font-size:13px;margin-right:8px;">SF</span>Studio Flows
      </div>
      <div style="background:#ffffff;border:1px solid #e4e6ea;border-radius:16px;padding:26px 24px;">
        <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1a1c1f;">Confirm your email</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f4650;">Welcome to Studio Flows. Confirm this address to finish setting up your account.</p>
        <div style="margin:24px 0;">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:11px;">Confirm my email</a>
        </div>
        <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#99a1ad;word-break:break-all;">Or paste this link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard</p>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#99a1ad;">If you did not create a Studio Flows account, you can ignore this email.</p>
      </div>
      <p style="margin:16px 4px 0;font-size:11px;color:#aeb4bd;">Sent by Studio Flows.</p>
    </div>
  </body>
</html>
```

### Reset password

Subject: `Reset your Studio Flows password`

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="margin-bottom:20px;font-weight:800;font-size:18px;color:#1a1c1f;letter-spacing:-0.3px;">
        <span style="display:inline-block;background:#4f46e5;color:#fff;border-radius:8px;padding:3px 7px;font-size:13px;margin-right:8px;">SF</span>Studio Flows
      </div>
      <div style="background:#ffffff;border:1px solid #e4e6ea;border-radius:16px;padding:26px 24px;">
        <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1a1c1f;">Reset your password</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f4650;">Use the button below to set a new password. The link expires in one hour.</p>
        <div style="margin:24px 0;">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:11px;">Set a new password</a>
        </div>
        <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#99a1ad;word-break:break-all;">Or paste this link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password</p>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#99a1ad;">If you did not ask to reset your password, nothing has changed and you can ignore this email.</p>
      </div>
      <p style="margin:16px 4px 0;font-size:11px;color:#aeb4bd;">Sent by Studio Flows.</p>
    </div>
  </body>
</html>
```

### Change email address

Subject: `Confirm your new Studio Flows email`

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="margin-bottom:20px;font-weight:800;font-size:18px;color:#1a1c1f;letter-spacing:-0.3px;">
        <span style="display:inline-block;background:#4f46e5;color:#fff;border-radius:8px;padding:3px 7px;font-size:13px;margin-right:8px;">SF</span>Studio Flows
      </div>
      <div style="background:#ffffff;border:1px solid #e4e6ea;border-radius:16px;padding:26px 24px;">
        <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#1a1c1f;">Confirm your new email</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f4650;">Confirm this address to finish moving your Studio Flows account to it.</p>
        <div style="margin:24px 0;">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:11px;">Confirm this address</a>
        </div>
        <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#99a1ad;word-break:break-all;">Or paste this link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings</p>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#99a1ad;">If you did not request this change, ignore this email and your address stays as it is.</p>
      </div>
      <p style="margin:16px 4px 0;font-size:11px;color:#aeb4bd;">Sent by Studio Flows.</p>
    </div>
  </body>
</html>
```

The "Invite user" and "Magic link" templates can be left alone. Studio Flows
sends its own invites through Resend and does not use magic links, so neither
one fires.

## 3. Then turn Confirm email on

**Authentication → Sign In / Providers → Email → Confirm email.**

DONE, 30 July 2026. It had been off, which was a real hole rather than a
preference: `claim_pending_invites()` (migration 0048) matched a signup against
`studio_invites.email` with no verification check, so anyone who knew an
invited address could sign up as it and land inside that studio.

Migration **0079** now enforces the same rule in the database: both claim
functions look up the caller's address with `email_confirmed_at is not null`,
so an unconfirmed user matches no invite. That is deliberately applied AFTER
the toggle, since with confirmation off it would have made every invite
unclaimable. If the toggle is ever switched back off, revert 0079 with it.

## What stays unbranded

The link host is ours, but the underlying token is still verified by Supabase,
and if anyone inspects the message headers they will see Resend. That is
ordinary: every product's mail is sent by someone. The only remaining
Supabase-visible surface is the OAuth consent screen for "Sign in with Google",
which names the Supabase project unless a custom auth domain is configured
(Pro add-on, **Settings → Custom Domains**). Worth doing before a public
launch, not before a colleague beta.
