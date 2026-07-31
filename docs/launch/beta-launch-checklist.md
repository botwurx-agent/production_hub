# Beta launch checklist

Companion to `pre-launch-audit-2026-07.md`. The code hardening from the audit's
Tier 0 list is done and on the branch; this tracks the steps that live outside
the codebase (dashboards, accounts) plus the deliberate follow-ups.

## Manual steps before inviting beta users

- [x] **Enable Supabase leaked-password protection.** DONE and VERIFIED
      2026-07-31: the `auth_leaked_password_protection` lint no longer appears in
      `get_advisors(type: "security")`, which is the check, not the dashboard
      toggle looking flipped. Was blocked on plan for a while (a PRO feature, so
      on Free the control did not appear at all, which reads as "cannot find it"
      rather than "not available").

- [x] **Upgrade Supabase to Pro before inviting anyone.** DONE 2026-07-30.
      Storage headroom and daily backups are the reason it mattered; point-in-
      time recovery is a separate paid add-on and is not needed for beta.
      Original reasoning: The reason is storage
      and backups, not the password toggle. Checked 2026-07-30: 73 files, 545 MB
      of the Free plan's 1 GB file limit, used by the operator's own testing
      alone. Two or three beta studios uploading a single cut each will hit the
      ceiling within days, and the failure mode is uploads silently failing,
      which reads to a beta user as "the app is broken" rather than "the plan is
      full". Free also has no point-in-time recovery, and beta users will be
      storing client contracts, budgets and signed SOWs. The database itself is
      tiny (17 MB); it is entirely a file-storage question.
- [x] **Create a Sentry project and set the DSN.** DONE and VERIFIED 2026-07-30
      via `/api/diagnostics/sentry`: configured true, event captured, flush
      delivered. The browser SDK shares the same DSN but initialises separately
      in instrumentation-client.ts, so client capture is very likely fine and
      strictly unproven until a real UI error occurs.
      Original note: Set `NEXT_PUBLIC_SENTRY_DSN`
      in Vercel. For source-map upload also set `SENTRY_ORG`, `SENTRY_PROJECT`,
      and `SENTRY_AUTH_TOKEN` (Vercel + CI). Everything is inert until the DSN is
      set, so nothing breaks if you defer this.
      VERIFY IT with `GET /api/diagnostics/sentry` while signed in as a studio
      member: it reports whether a DSN is present in the runtime, sends a
      deliberate test error, waits for the flush, and returns the event id to
      search for. Add `?throw=1` to test the unhandled-throw path instead of the
      explicit-capture path (most of the app reports through reportError, but an
      uncaught throw goes through instrumentation's onRequestError, and they can
      fail independently).
- [ ] **Turn on Vercel Analytics** for the project in the Vercel dashboard (the
      `<Analytics/>` tag is already wired).
- [x] **Fill the legal placeholders** in `/terms` and `/privacy`. DONE
      2026-07-30. Written for the actual situation: a free invited beta run by
      an individual, pre-incorporation, so the pages say that rather than
      inventing an entity. Contact is studioflows1@gmail.com throughout. No
      governing jurisdiction is named, deliberately: there is no company to
      attach one to yet, and a made-up one is worse than an honest omission.
      Privacy now names the real subprocessors (Supabase, Vercel, OpenAI,
      Resend, Sentry), says data is stored in the US, states that project
      content is sent to the AI provider only when an AI feature is invoked,
      and commits to export or deletion within 30 days of an emailed request.
      STILL NEEDS COUNSEL before the Service is offered commercially, and the
      governing-law clause needs adding once the entity exists.
- [x] **Decide on email confirmation.** DONE 2026-07-30: confirmation is ON.
      It is not only a preference: `claim_pending_invites()` matched a signup
      against an invited address with no verification check, so with the toggle
      off anyone who knew an invited address could sign up as it and land inside
      that studio. Migration 0079 enforces the same rule in the database. ORDER
      MATTERS if this is ever revisited: with confirmation off nobody gets an
      `email_confirmed_at`, so 0079 would make every invite permanently
      unclaimable. Revert 0079 alongside the toggle, never on its own.
- [x] **Brand the Supabase Auth emails.** DONE and VERIFIED 2026-07-30, see
      `supabase-auth-emails.md`. Custom SMTP points at the same Resend account
      the app uses, all three templates carry the SF layout, and Site URL matches
      `NEXT_PUBLIC_SITE_URL`. A password reset was run end to end: branded mail,
      link on `app.studio-flows.com`, landing on `/reset-password`. Shipped with
      it: `/auth/confirm` now also accepts a PKCE `code`, without which recovery
      is broken under Supabase's default templates, and `requestPasswordReset`
      reports a real send failure to Sentry instead of always saying "check your
      inbox".
- [ ] **Read beta feedback** in the Supabase dashboard: the `feedback` table
      collects in-app submissions (there is no read policy by design).

## Deliberate follow-ups (not beta blockers)

- **SECURITY DEFINER functions executable by `anon` / `authenticated`** (lints
  0028 / 0029, all WARN, checked 2026-07-31). These are the only security
  advisories left. Not a leak, and mostly by design, but worth a pass before a
  public launch rather than a colleague beta:
  - `studio_invite_preview` / `project_invite_preview` are DELIBERATELY granted
    to `anon`: the accept page reads them before the invitee has a session, and
    both require a 192-bit token. Leave alone.
  - `is_studio_member` / `is_studio_admin` / `can_access_project` /
    `review_target_project` / `review_comment_project` are the RLS helpers. They
    answer only about the CALLER (is_studio_member) or resolve a row to its
    project id, so a signed-in user learns nothing about anyone else.
  - `claim_pending_invites` / `claim_pending_project_invites` must stay callable
    by `authenticated`, that is the whole mechanism, and since 0079 they match
    only a CONFIRMED address, so an anon or unconfirmed caller matches nothing.
  - The tightening, if done: revoke EXECUTE from `anon` ONLY, and only on the
    five that no anon path uses (the public portals `/r`, `/rb`, `/c`, `/p` go
    through the SERVICE role, so they are unaffected: verify that before
    changing anything). Do NOT revoke from `authenticated`: a policy that calls
    a function needs the querying role to hold EXECUTE, so that would break RLS
    across the app rather than harden it.

- ~~Collaborator asset-version upload + internal doc-review image signing.~~
  DONE. Uploads stay direct-to-storage (a server relay would hit the ~4.5MB
  request-body cap and break video) but are now authorized by a server-minted
  one-shot signed upload URL, gated on project access rather than studio
  membership. Doc-review images sign through assetStorage(). Still worth an
  end-to-end run with a real second account.
- **Next.js 15/16 (React 19) upgrade.** We patched to 14.2.35 (clearing the
  critical Server Actions DoS + middleware SSRF). The remaining audit advisories
  are fixed only in Next 15/16, which is a major React 19 migration and should be
  its own tested effort, not a hardening-pass side change.
- **Hard rate limiting.** The public token routes (`/r`, `/c`) now have a
  best-effort in-memory limiter. For a shared, durable limit across serverless
  instances, back it with Upstash / Vercel KV.
- ~~Broader swallowed-error sweep.~~ DONE. `logWrite` (lib/log.ts) wraps a
  Supabase write, reports a failure through `reportError`, and returns the
  result untouched. Applied to 166 discarded writes across 33 action files, so
  a row that fails to save now shows up in the logs and in Sentry instead of
  looking exactly like success. Control flow is unchanged by design: this makes
  failures observable, it does not invent recovery behaviour. Actions that can
  meaningfully recover still check the error themselves and tell the user
  (projects, notifications, review, tasks, upload).
- **Sentry client bundle.** The browser SDK adds ~76 kB to first-load JS. If that
  matters for the marketing-critical pages, scope Sentry to server-only or lazy
  it.
- ~~Email delivery of invites.~~ DONE. Studio and project-collaborator invites
  are emailed via Resend; the copy-link path remains as a fallback and is the
  only path when `RESEND_API_KEY` / `EMAIL_FROM` are unset. Re-inviting a
  pending address re-sends.
- ~~Multi-studio switcher.~~ DONE. Active studio comes from the `sf_studio`
  cookie (validated against the caller's memberships), with a picker in the
  sidebar header and in the user menu on mobile.

## What shipped in the hardening pass (branch `claude/pre-launch-audit-competitive-a08026`)

- Password reset + confirmation resend (auth recovery).
- Error boundaries (global-error / app / in-shell), branded 404s, loading
  skeletons.
- SSRF fix in link unfurl (per-hop DNS validation, manual redirects).
- Swallowed write errors surfaced (toast + central `reportError`).
- Paused billing entry points hidden.
- Terms + privacy pages.
- CI (typecheck + build) on push/PR.
- Sentry + Vercel Analytics wired (inert until configured).
- In-app feedback widget (migration 0058 `feedback`).
- Public-route rate limiting; complete `.env.example`; Next.js 14.2.35 security
  patch.
