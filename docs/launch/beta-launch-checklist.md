# Beta launch checklist

Companion to `pre-launch-audit-2026-07.md`. The code hardening from the audit's
Tier 0 list is done and on the branch; this tracks the steps that live outside
the codebase (dashboards, accounts) plus the deliberate follow-ups.

## Manual steps before inviting beta users

- [ ] **Enable Supabase leaked-password protection.** Dashboard: Authentication
      → Policies → turn on "Leaked password protection" (checks HaveIBeenPwned).
      This is the one remaining actionable security-advisor item; it is a toggle,
      not code.
- [ ] **Create a Sentry project and set the DSN.** Set `NEXT_PUBLIC_SENTRY_DSN`
      in Vercel. For source-map upload also set `SENTRY_ORG`, `SENTRY_PROJECT`,
      and `SENTRY_AUTH_TOKEN` (Vercel + CI). Everything is inert until the DSN is
      set, so nothing breaks if you defer this.
- [ ] **Turn on Vercel Analytics** for the project in the Vercel dashboard (the
      `<Analytics/>` tag is already wired).
- [ ] **Fill the legal placeholders** in `/terms` and `/privacy`
      (`[Studio legal name]`, `[contact email]`, `[jurisdiction]`) and have them
      reviewed by counsel.
- [ ] **Decide on email confirmation.** Users now have password reset and a
      resend-confirmation path, so keeping confirmation on is safe. If you want a
      frictionless beta, you can disable it in Supabase Auth instead.
- [ ] **Read beta feedback** in the Supabase dashboard: the `feedback` table
      collects in-app submissions (there is no read policy by design).

## Deliberate follow-ups (not beta blockers)

- **Collaborator asset-version upload + internal doc-review image signing.** The
  two known gaps from CLAUDE.md: a project collaborator still cannot upload a new
  asset version (client-side storage is member-gated) and internal doc-review
  images are not service-signed for them. Their main tasks (storyboard/moodboard
  edits, call sheets) work. Fix = a server upload endpoint that service-uploads
  bytes, mirroring the storyboard path.
- **Next.js 15/16 (React 19) upgrade.** We patched to 14.2.35 (clearing the
  critical Server Actions DoS + middleware SSRF). The remaining audit advisories
  are fixed only in Next 15/16, which is a major React 19 migration and should be
  its own tested effort, not a hardening-pass side change.
- **Hard rate limiting.** The public token routes (`/r`, `/c`) now have a
  best-effort in-memory limiter. For a shared, durable limit across serverless
  instances, back it with Upstash / Vercel KV.
- **Broader swallowed-error sweep.** The projects + notifications actions now
  surface failures via toast + `reportError`. The same pattern should be applied
  to the other action files over time (the reportError seam is ready).
- **Sentry client bundle.** The browser SDK adds ~76 kB to first-load JS. If that
  matters for the marketing-critical pages, scope Sentry to server-only or lazy
  it.

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
