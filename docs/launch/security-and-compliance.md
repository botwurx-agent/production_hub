# Security and compliance, before launch

Two things live here.

1. The **marketing security section** the operator wants (StudioBinder has one
   on their pricing page and it is a good idea). It is PARKED until two-factor
   auth exists, on the operator's call, for the reason below.
2. Everything else that has to be true, built, or published before real studios
   and their clients trust this with a job: security work, and the legal and
   regulatory pages a site and an app are required to carry.

Nothing here is a beta blocker on its own. All of it is a launch blocker in
aggregate, and the order at the bottom is the order to do it in.

---

## 1. The security section (PARKED, gated on 2FA)

### Why it is parked

Publishing a security section invites the questions a security section answers.
The first thing anyone security-minded looks for is two-factor auth, and its
absence is far more conspicuous once we have raised the subject ourselves than
it is while we stay quiet. So the section ships the same week 2FA does, not
before.

### THE RULE: our claims, not theirs

StudioBinder's panel says "a dedicated database and file storage, exclusively
siloed in its own dedicated cloud". That describes one Postgres instance per
customer. We run ONE shared Postgres with row-level security, and one private
bucket with per-studio folders. Copying their section would make the headline,
the subhead and three of the diagram labels false.

This matters more than it does anywhere else on the site. lib/marketing/
pricing.ts already carries the rule that a checkmark next to something that does
not exist is a refund; a security claim is that rule at maximum stakes, because
it is the one section a client's IT or legal reviewer may actually test.

Their pitch is also the wrong pitch for this buyer. "Dedicated cloud" means
nothing to a producer and "bank-level encryption" is noise. Ours answers the
question a production studio actually has, which is WHO CAN SEE WHAT.

### The claims we can make, and where each is enforced

| Claim | Enforced by |
| --- | --- |
| The database enforces the boundary, not the app | RLS on every table via `is_studio_member(studio_id)`; a leak needs a wrong policy, not a forgotten filter |
| Crew see one job, and the rest of the studio is invisible rather than hidden | `project_members` + `can_access_project`; a collaborator holds no membership, so studio-wide tables return nothing (0056) |
| Rates and money are not in the tables crew can read at all | `contact_rates`, `deliverable_pricing`, `generation_costs`, all `is_studio_member` only (0074); the columns were DROPPED from the readable parents |
| A crew member's task list is only their own | assignment-scoped policies (0100) |
| The project summary never reaches crew | `project_summaries` is studio-only (0099) |
| Clients need no account, and a link is scoped and revocable | `review_links`, 192-bit token (`randomBytes(24)`), per asset or document, revocable |
| Files are never public | private `assets` bucket, short-lived signed URLs, token-guarded proxy for the portal |
| Passwords are never ours to lose | Supabase Auth, leaked-password protection ON, email confirmation required (and invites only claimable by a confirmed address, 0079) |
| A signed proposal keeps its audit trail | signer name, email, IP, timestamp, frozen into the snapshot (0060) |

### The claims we must never make

Dedicated database or dedicated cloud. "Bank-level encryption". SOC 2, ISO or
any certification of our own. Penetration tested. SSO. Data residency. An uptime
SLA. Anything about training data we have not verified in the provider's terms
THIS QUARTER.

### Shape when it ships

A band near the bottom of `/pricing`, above the FAQs, with a token-drawn
diagram in the `components/marketing/motifs.tsx` style. Never a fake screenshot,
and no "Schedule a call" (we have no sales calls to schedule). Reusable on the
marketing home if it earns its place there.

---

## 2. Security work

Ordered by what unblocks the most, not by difficulty.

### 2.1 Two-factor auth (TOTP) — the gate on everything above

Supabase Auth supports TOTP enrolment and challenge natively, so this is app
work rather than infrastructure. What it needs:

- enrolment in Settings (QR, verify, store nothing ourselves)
- a challenge step in the sign-in flow
- recovery codes, and a documented path when someone loses their phone, which
  is the half people forget and the half that generates support
- optional but worth it: require `aal2` for the actions that would hurt most
  (removing a member, revoking access, deleting a client)

Phone/SMS factors are a paid Supabase add-on and are worse security than TOTP.
Do not bother.

### 2.2 Prove the backups restore

Supabase Pro takes daily backups (point-in-time recovery is a separate add-on
we have not bought). An untested backup is a hope, not a backup. Restore one
into a scratch project once, write down how long it took, and put that number
in this file. Do it before real studios have work in here, not after.

### 2.3 Rate limiting is best-effort and per-instance

`lib/rate-limit.ts` is in-memory, so on serverless it limits per instance
rather than per attacker. It is honest about that in its own comments. Before
real traffic reaches the public routes (`/r`, `/c`, `/p`, `/rb`), move it to a
shared store. This is the difference between a speed bump and a limit.

### 2.4 Tighten the SECURITY DEFINER grants

`get_advisors(type: "security")` reports (checked 2026-08-29, all WARN, no
ERROR) that several `SECURITY DEFINER` functions are executable by `anon`.
Some genuinely must be: `studio_invite_preview` and `project_invite_preview`
are read by the logged-out accept pages. Others were granted to `anon` by
migration 0056's blanket grant line and have no anonymous caller:
`task_project`, `is_task_assignee`, `review_target_project`,
`review_comment_project`, `ai_entity_project`, `can_edit_project`.

Low severity (each takes a uuid the caller must already know and returns a
boolean or a uuid), but revoking `EXECUTE` from `anon` on those six costs
nothing and shrinks the anonymous surface. Also move the `pg_net` extension out
of the `public` schema while in there.

### 2.5 A studio-level audit log

There is a per-project `activity` feed, which is a work log rather than a
security log. There is no answer to "who removed that member" or "who revoked
that share link". Small table, big credibility, and the thing an agency asks
for second after 2FA.

### 2.6 Keep the platform patched

Next is on 14.2.35. The remaining audit items need a Next 15/16 (React 19)
major upgrade, which is deferred but should be SCHEDULED rather than left to
drift, because "deferred" and "forgotten" look identical after six months.

---

## 3. Legal and regulatory

### 3.1 Must be true before the first paying customer

- **Terms of Service and Privacy Policy reviewed by counsel.** Both exist at
  `app/(legal)/` and both are placeholders carrying a counsel note. They are
  honest about the product but they are not legal documents yet.
- **AI DISCLOSURE, and this is the one most likely to bite.** We send customer
  documents to a third-party model: supplier invoices and estimates, signed
  SOWs, treatments, and the project context behind Runner and the summaries.
  A brand or agency contract may forbid exactly that. It has to be stated
  plainly in the privacy policy, the provider's data-retention and
  training terms have to be cited accurately (verify them at the time, do not
  quote from memory), and a studio-level "no AI features" switch is the honest
  escape hatch for a client who cannot allow it.
- **Subprocessor list**, published: Supabase, Vercel, Resend, OpenAI and/or
  Anthropic, Google (Gmail, Drive, Calendar, Chat), Slack, Figma, Sentry.
  Required by GDPR Article 28 and asked for by any agency's procurement.
- **Account deletion that actually deletes.** Today there is no hard delete
  anywhere: projects archive, and archiving is deliberately non-destructive.
  GDPR and CCPA both give a right to erasure, so "delete my studio" must remove
  rows AND purge the storage blobs, and we must be able to say how long it
  takes. This is real work, not a policy line.
- **Data export.** The portability half of the same right. A CSV of the studio's
  own records plus a way to pull the files down.
- **Cookie and analytics position.** Vercel Analytics is cookieless and Sentry
  sets no cookie unless session replay is enabled (verify both at the time). If
  that holds, we can likely avoid a consent banner for analytics, and the
  position should still be written down in the privacy policy rather than
  assumed. Auth cookies are strictly necessary and need no consent.
- **Marketing email compliance.** Transactional mail (invites, review nudges,
  call-sheet chasing) is exempt from the opt-out rules; the beta outreach in
  `beta-outreach-email.md` is not. Unsubscribe link and a postal address on
  anything promotional, per CAN-SPAM, and consent before sending to EU/UK
  addresses under GDPR and PECR.
- **A security contact.** `security@` or a `/security` page with a disclosure
  address, so someone who finds a hole has somewhere to send it that is not
  Twitter.

### 3.2 Before taking money

- **Incorporate.** The privacy policy currently says, accurately, that no
  company has been incorporated. That has to change before invoicing anyone,
  and both legal pages then need the entity name.
- **Sales tax and VAT.** Digital services VAT in the EU and UK is the seller's
  obligation regardless of size. Stripe Tax or an equivalent, decided before
  the first international customer rather than after.
- **PCI.** Using Stripe's hosted elements keeps us out of scope entirely. Never
  let a card number touch our servers.
- **A refund policy**, stated on the pricing page.

### 3.3 Before an agency or brand of any size

- **A DPA template** ready to sign, with the subprocessor list attached.
- **Security questionnaire answers** written once and kept current. Half of
  this file is the raw material.
- **SOC 2** when it is genuinely asked for. It is a 12-month, five-figure
  exercise; doing it early would be theatre.
- **Cyber liability insurance**, which also appeared on the producer friend's
  list.
- **Accessibility (WCAG 2.1 AA).** Brands and agencies increasingly require it
  contractually, and it carries real ADA exposure in the US. The app has never
  been audited for it.

---

## 4. The order

1. 2FA. It gates the marketing section and it is the first thing anyone asks.
2. Account deletion and export. Legally required, and genuinely unbuilt.
3. AI disclosure plus a studio-level off switch. Cheapest deal-saver here.
4. Prove a backup restores.
5. Counsel review of Terms and Privacy, with the subprocessor list.
6. Shared-store rate limiting, the `anon` grant tightening, the audit log.
7. Then publish the security section, and answer questionnaires from it.
