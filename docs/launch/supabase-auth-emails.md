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

DONE, 30 July 2026. Settings below are what is live.

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

### Two things that cost an hour when this was first set up

Both surfaced as "no email arrives", with nothing in the inbox to diagnose
from. The auth log is the place to look: **Supabase → Logs → Auth**, or the
`get_logs` MCP tool. A failed send appears as `POST /recover` with status 500
and the SMTP error attached.

- **The Password field takes the Resend API key, which starts `re_`.** A
  Supabase key (`sb_publishable_...` / `sb_secret_...`) pasted there is a
  different credential entirely, and Resend answers `535 "Authentication
  credentials invalid"`. The 535 is raised at login to the mail server, before
  any message exists, so it says nothing about the address or the template.
- **Sender email must be on the Resend-verified domain**, spelled exactly.
  `support@studio-flow.com` (missing the s) would have failed after the key was
  fixed, with a different error, sending the hunt round a second time. The
  address that works is the same one in `EMAIL_FROM` on Vercel.

That duplication is worth knowing about: the sender address lives in two places
(`EMAIL_FROM` in Vercel, and this dashboard field) with nothing keeping them in
step, which is exactly how the typo survived.

## 2. Replace the templates

DONE, 30 July 2026. All three pasted and the reset one verified end to end:
branded, link on `app.studio-flows.com`, lands on `/reset-password`.

Dashboard: **Authentication → Emails → Templates**. Three templates can fire.
Paste the HTML below into each, replacing the existing body outright rather
than editing it.

**Copy from inside the fences, not including them.** Each block below is
delimited by an opening ` ```html ` and a closing ` ``` `. Those belong to this
markdown file, not to the template. Supabase pastes whatever it is given
verbatim, so a stray fence renders as literal text at the top of the email that
every recipient sees. It happened on the first pass here. The content must
start at `<!doctype html>` and end at `</html>`.

Set the **Subject** on each screen too: `Confirm your Studio Flows account`,
`Reset your Studio Flows password`, `Confirm your new Studio Flows email`.

It is the same layout as
`lib/email-template.ts`, hand-inlined, since Supabase renders a raw string and
cannot import from this codebase. If the app's email design changes, these
have to be updated by hand; that duplication is the price of Supabase owning
the auth mail.

Every link points at **our** `/auth/confirm` route with `token_hash` + `type`,
not at the Supabase verify endpoint. That matters for branding: the URL the
recipient hovers reads `studio-flows.com`, not `<project-ref>.supabase.co`.
The route already accepts exactly these parameters.

`{{ .SiteURL }}` comes from **Authentication → URL Configuration → Site URL**,
so set that to the production origin before pasting these in. It is
`https://app.studio-flows.com`, matching `NEXT_PUBLIC_SITE_URL` on Vercel.

The `app.` matters. Both `studio-flows.com` and `app.studio-flows.com` alias
the same Vercel deployment, so a link to either will load. But the session
cookie is set on whichever host serves the confirm route, so if Supabase sends
people to the bare domain while the app runs on `app.`, a user can be signed in
on one host and signed out on the other. Keep the two settings identical.

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

## The confirm route accepts both link shapes

`app/auth/confirm/route.ts` handles two kinds of link, and it has to.

- **`token_hash` + `type`**, which the templates above produce. The link comes
  straight here and `verifyOtp` spends the token. One hop, our domain
  throughout. (With PKCE enabled the hash arrives prefixed `pkce_`, which
  `verifyOtp` handles.)
- **`code`**, which Supabase's DEFAULT templates produce via
  `{{ .ConfirmationURL }}`. That URL points at the project's own
  `/auth/v1/verify`, which spends the token itself, creates the session, then
  redirects here with a code to exchange.

The second branch was added on 30 July after recovery failed on the stock
template. The route only accepted `token_hash`, so it discarded a valid session
and redirected to `/login?error=confirmation_failed`. The message said the link
may have expired, which was false on the first click and then true on every
retry, because the first click had already spent the token. The auth log showed
it exactly: a 303 carrying a `login` event, then two 403s reading `One-time
token not found`.

So do not "simplify" the route back to one branch on the grounds that our
templates only ever send `token_hash`. The default template is what a fresh
Supabase project ships with, and the failure it causes is both silent and
self-disguising.

## What stays unbranded

The link host is ours, but the underlying token is still verified by Supabase,
and if anyone inspects the message headers they will see Resend. That is
ordinary: every product's mail is sent by someone. The only remaining
Supabase-visible surface is the OAuth consent screen for "Sign in with Google",
which names the Supabase project unless a custom auth domain is configured
(Pro add-on, **Settings → Custom Domains**). Worth doing before a public
launch, not before a colleague beta.
