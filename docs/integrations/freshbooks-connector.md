# FreshBooks billing connector — build spec

Status: **planned, not implemented.** Roadmap Phase 6/8 (connections + production-ops).
Principle: orchestrate, don't replace — The Hub is the control surface; FreshBooks
stays the system of record for money + accounting.

## Verdict
Feasible. FreshBooks has a REST API (OAuth2) covering create client, create
invoice, email/send, attach an online-payment option, and webhooks for payment
events. Shape = one OAuth connector, two phases.

## The key distinction: send vs pay
- **Sending** an invoice → fully ours to build.
- **Getting paid** → we do NOT process payments. Payment happens on FreshBooks'
  hosted invoice page (its Stripe/ACH gateway). We attach that pay option via the
  API, surface the hosted link, and reflect paid status. Card data + PCI scope
  never touch The Hub. This is the correct, safer architecture.

## Ownership
- The Hub: connection (OAuth tokens/refresh/account id), client+deliverables →
  line items, create/send UX, status mirror (draft→sent→viewed→paid) +
  notifications, a "View/pay" link.
- FreshBooks: invoice of record + numbering, tax/currency/accounting, hosted
  payment page + "Pay now", money movement, client emails/reminders.

## Connection (Settings → Connections, like Google/Figma)
1. Register a FreshBooks app → FRESHBOOKS_CLIENT_ID / FRESHBOOKS_CLIENT_SECRET,
   redirect /auth/freshbooks/callback.
2. OAuth2 authorize → exchange code for access + refresh tokens.
3. Resolve account/business id via GET /auth/api/v1/users/me; store tokens
   (encrypted) in billing_accounts.
4. Refresh access tokens (~12h life) on demand in the API wrapper.

## Phase 1 — connect → create → send → status (~80% of value)
Schema:
- billing_accounts: studio_id, provider, access_token, refresh_token,
  expires_at, fb_account_id, fb_business_id (tokens encrypted; RLS by studio).
- project_invoices: project_id, fb_invoice_id, number, status, amount,
  amount_paid, currency, hosted_url, updated_at.

Files:
- lib/freshbooks.ts (new) — API client + token refresh.
- app/auth/freshbooks/start + /callback (new) — OAuth.
- app/(app)/projects/[id]/billing-actions.ts (new) — createInvoice /
  sendInvoice / syncInvoice.
- components/production/delivery-panel.tsx (edit) — invoice UI on billing card.
- Settings → Connections (edit) — connect/disconnect.

FreshBooks calls:
- POST /accounting/account/<acct>/users/clients (create client if needed)
- POST /accounting/account/<acct>/invoices/invoices (create invoice)
- PUT …/invoices/<id> with action_email (send / mark sent)
- GET …/invoices/<id> (refresh status)

Done when: connect once, Create invoice on a project, Send, see it flip to Sent,
invoice correct in FreshBooks.

## Phase 2 — online payment + paid sync
- Attach payment option on create:
  POST /payments/account/<acct>/invoice/<id>/payment_options.
- Webhook endpoint app/api/freshbooks/webhook/route.ts — register
  invoice.update + payment.create; verify signature; on payment set
  amount_paid/status=paid + notification.
- Polling fallback on page load if webhooks deferred.

Done when: client pays on FreshBooks page → billing card shows Paid + bell
notification within seconds, no manual refresh.

## Risks / handling
- Payments/PCI: out of scope (hosted). Studio must enable online payments in
  FreshBooks for "Pay now".
- Token security: encrypt at rest, refresh before expiry, RLS by studio.
- Account/business id: resolved once at connect.
- Webhooks: need a verified public endpoint; polling is the lighter start.
- Egress: allow outbound to api.freshbooks.com (fine on Vercel).
- Testing: FreshBooks sandbox is thin — use a trial/real account.
- Tax & currency: left to FreshBooks.

## Env vars
FRESHBOOKS_CLIENT_ID, FRESHBOOKS_CLIENT_SECRET (redirect
<domain>/auth/freshbooks/callback).

## Recommendation
Build Phase 1 first (low-risk, most of the value); layer Phase 2 after one real
invoice run. Alternative if send+pay without a separate tool is ever wanted:
Stripe Invoicing — but FreshBooks keeps the studio's books in one place.
