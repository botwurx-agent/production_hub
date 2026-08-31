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

## Slack connector (Slack OAuth)

Slice 1a is the connection (user-token read scopes). To enable it you need a
Slack app.

Setup (one time):

1. api.slack.com/apps -> **Create New App** -> From scratch. Pick your
   workspace.
2. **OAuth & Permissions** -> **Redirect URLs** -> add:
   - `https://<your-vercel-domain>/auth/slack/callback`
   - `http://localhost:3000/auth/slack/callback`
3. Under **Scopes -> User Token Scopes**, add: `channels:history`,
   `channels:read`, `groups:history`, `groups:read`, `im:history`, `im:read`,
   `mpim:history`, `mpim:read`, `users:read`, `files:read`, `search:read`.
   (Bot scopes are not required.)
4. **Basic Information** -> copy the **Client ID** and **Client Secret**.
5. Set env vars (Vercel + local), all environments, then redeploy:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
6. In the app: Settings -> Connections -> **Connect Slack**.

Slack user tokens do not expire, so there is no refresh step. Read/link and
file import are layered in later slices.

## Marketing screenshots and demo clips

The marketing site's evidence is generated, never hand-taken, so it cannot
drift away from the product. Two scripts, both driving the real demo studio in
a real browser at the same 1503x852 viewport, so a still and a clip are
interchangeable in a page section.

One-time setup, run from the repo root:

```
npm i --no-save playwright
npx playwright install chromium
```

`--no-save` because Playwright is deliberately NOT in package.json: it is only
ever run by hand, and as a devDependency its postinstall would download about
150MB of browsers on every Vercel build. It still has to live in the repo's own
`node_modules` rather than being installed globally, since the scripts do a
bare `import { chromium } from "playwright"` and Node resolves that by walking
up from the script, never through the global root. The second line downloads
the browser itself into a shared per-user cache, so it is only ever needed once
per machine.

The transcode to MP4 needs an ffmpeg. Any one of these is enough, and the
script says which it found:

```
brew install ffmpeg        # or
npm i --no-save ffmpeg-static   # or
pip install imageio-ffmpeg
```

Then, with the dev server running against the real Supabase project:

```
npm run dev                             # terminal 1
DEMO_PASSWORD=... npm run shots         # terminal 2, screenshots
DEMO_PASSWORD=... npm run demos         # terminal 2, clips
```

- `DEMO_PASSWORD` is the demo studio's login. `BASE_URL` overrides the target
  if you are not on the default dev port. `CHROMIUM_PATH` points at a browser
  binary if Playwright's own is not where it expects. `FFMPEG` points at a
  transcoder directly.
- `shots` writes PNGs into `public/marketing/shots/`; `demos` writes a WebM, an
  MP4 and a JPG poster per clip into `public/marketing/demos/`. Commit what
  they produce.
- A page renders a labelled placeholder naming any shot or clip that has not
  been captured yet, so the site is designable before the media exists.
- `demos` performs real interactions, so it WRITES to the demo studio. Every
  card a clip creates is deleted afterwards by id. If a run dies halfway, check
  the board it was recording before re-running.
- Adding a clip: add an entry to `CLIPS` in `scripts/capture-demos.mjs`, and
  give whatever it drives a `data-demo` attribute in the component. Anchor on
  `data-demo`, never on a CSS class, or restyling will silently break the
  recording.
- Neither script can run inside a Claude Code session: the agent proxy denies
  CONNECT to the Supabase host, so the dev server there cannot sign in at all
  (it surfaces as a login error reading `Host not i... is not valid JSON`).

## Conventions

- Token-first styling: never hardcode colors. Use the Tailwind tokens that map
  to the CSS variables in `app/globals.css` (both light and dark must work).
- Color-as-signal: status is shown with the small `StatusTag` chip; status and
  hue mappings live in `lib/status.ts`.
- No em dashes in generated content (code, copy, docs, UI text).
- Connection-ready: `assets.source`, `*.external_ref`, and
  `activity.external_thread_ref` are nullable now and populated by connectors
  in a later phase.
