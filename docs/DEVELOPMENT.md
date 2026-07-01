# Development

The Hub is a Next.js (App Router, TypeScript) app on Supabase, styled
token-first with Tailwind. This covers local setup for Phase 1.

## Prerequisites

- Node 20+ (developed on Node 22)
- A Supabase project (already provisioned for this app)

## Environment

Copy `.env.example` to `.env.local` and fill in the project values:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
```

Both are public, browser-safe values. Row-level security enforces all access
rules, so there is no service-role key in the app.

## Run

```
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
```

> Network note: the app makes server-side calls to `*.supabase.co`. If you run
> it inside a restricted-egress environment (for example a sandboxed CI/agent
> container), that host must be on the egress allowlist or auth/data calls will
> fail with "Host not in allowlist". Vercel and normal machines are unaffected.

## Database

Migrations live in `supabase/migrations/` and are the source of truth for the
schema. They have been applied to the project. Order:

1. `0001_spine_and_tenancy.sql` - the full data-model spine (Lead -> Client ->
   Project -> Brief / Assets -> Versions / Approvals / Activity), multi-tenancy
   (studios, memberships, roles), RLS scoped by studio membership, and the
   signup studio-bootstrap trigger.
2. `0002_storage.sql` - private `assets` storage bucket with studio-scoped
   policies (path convention `{studio_id}/{project_id}/...`).
3. `0003_security_hardening.sql` - pin function search_path, restrict the
   signup trigger from the RPC surface.
4. `0004_helper_grants.sql` - lock the membership helpers to `authenticated`.

Regenerate types after schema changes and write them to
`lib/database.types.ts` (append the convenience aliases at the bottom).

## Multi-tenancy model

Every row belongs to a `studio`. A user joins studios through `memberships`
(role: owner / admin / member). RLS on every table uses
`is_studio_member(studio_id)` (a `SECURITY DEFINER` helper that bypasses RLS on
`memberships` to avoid recursion). On signup, a trigger creates the user's
studio and adds them as owner, reading the studio name from signup metadata.

## Gmail connector (Google OAuth)

The Gmail connector lets a user connect their Google account so a project's
email and attachments can live in the app. Slice 1a is the connection itself
(read-only scope). To enable it you need a Google Cloud OAuth client.

Setup (one time):

1. Google Cloud Console -> create/select a project.
2. APIs & Services -> Library -> enable **Gmail API**.
3. APIs & Services -> OAuth consent screen -> **External**. Set app name,
   support email, developer email. Add scopes `.../auth/gmail.readonly`,
   `openid`, `email`, `profile`. Add your address as a **Test user**. Leave the
   app in **Testing** mode (no Google verification needed for test users; up to
   100). Public launch later requires Google's verification for Gmail scopes.
4. APIs & Services -> Credentials -> Create credentials -> **OAuth client ID**
   -> **Web application**. Authorized redirect URIs:
   - `https://<your-vercel-domain>/auth/google/callback`
   - `http://localhost:3000/auth/google/callback` (local dev)
   Copy the **Client ID** and **Client secret**.
5. Set env vars (Vercel project settings + local `.env.local`), all
   environments, then redeploy:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
6. In the app: Settings -> Connections -> **Connect Gmail**.

Security note: OAuth tokens are stored in `email_accounts`, RLS-scoped to the
owning user. Before multi-user, move token reads to a service-role server
client (so tokens are never reachable via the public REST API) and encrypt
them at rest.

## Conventions

- Token-first styling: never hardcode colors. Use the Tailwind tokens that map
  to the CSS variables in `app/globals.css` (both light and dark must work).
- Color-as-signal: status is shown with the small `StatusTag` chip; status and
  hue mappings live in `lib/status.ts`.
- No em dashes in generated content (code, copy, docs, UI text).
- Connection-ready: `assets.source`, `*.external_ref`, and
  `activity.external_thread_ref` are nullable now and populated by connectors
  in a later phase.
