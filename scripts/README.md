# Demo studio and product screenshots

The marketing site shows the real product. That needs a studio whose data is
presentable and not a real client's, so there is a **demo studio** in the live
database and two scripts that turn it into images.

| | |
| --- | --- |
| Studio | Northline Studio |
| Sign in | `demo@studio-flows.com` / `N0rthline!Demo2026` |
| Studio id | `c094e1e7-b61e-4aaa-9fc9-8f41b233a4bd` |
| Flagship project | Bright Water hero spot, `b1000000-0000-4000-a000-000000000001` |

It holds six projects at four different stages, four accounts, an open deal
pipeline, and one job carried the whole way: brief, six storyboard frames, an
eight-shot list over two days, a sent call sheet, three versions of the hero cut
with a real review round (changes requested on v2, approved on v3), a budget
with four vendor invoices and a part-paid deposit, deliverables, a signed SOW
and an NDA, and a sent invoice. Every name in it is invented.

**This account is public-facing by intent.** Do not put anything in it you would
not show a stranger, and do not point it at a real client's files.

## 1. The media is already in place

Thirteen files are in storage: ten stills and three five-second cuts of the hero
spot, generated on Higgsfield and written straight into the bucket. Nothing
needs running for the demo studio to look finished.

To **replace** any of them with real work, drop a file of the matching name into
`scripts/demo-media/` and run:

```bash
node scripts/demo-media.mjs
```

It signs in as the demo user and overwrites in place, so the paths the seeded
rows point at never change. Filenames are listed at the top of the script.

<details>
<summary>How the files got there, since it is not the obvious route</summary>

The session that seeded the rows could reach the database but not the storage
API, so it could not upload anything directly. The way through was a temporary
Edge Function (`seed-demo-media`), which runs on Supabase's own infrastructure
and can therefore reach both: it took a list of source URLs and wrote each one
into the bucket with the service role, pinned to the demo studio's folder so it
could not write anywhere else. It was invoked from Postgres through the `http`
extension.

Both halves of that scaffolding are now shut: the token table it authenticated
against is dropped, so the function fails closed, and the `http` extension is
uninstalled. **The function itself still needs deleting by hand** in the
Supabase dashboard under Edge Functions, since the tooling here can deploy one
but not remove it. It cannot currently do anything, but a write endpoint should
not outlive the job it was written for.
</details>

## 2. Capture the screenshots

Playwright drives the browser and is deliberately not a dependency of the app,
so install it once, locally:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
npm run dev          # one terminal
npm run shots        # the other
```

Writes PNGs to `public/marketing/shots/`, which is what the marketing pages
read. Re-run it whenever the UI changes. That is the whole reason this is a
script and not a folder of hand-taken images: the site cannot quietly drift away
from the product.

Every shot fixes its own viewport, scale factor and theme rather than inheriting
them from the machine, because a page of screenshots taken at different scales
reads as assembled rather than designed. The script also pre-dismisses the tour
and the setup checklist, which otherwise pop a card over the middle of the UI.

## Rebuilding the demo studio

The seed is SQL, applied directly. If it is ever wiped, everything hangs off the
studio id above and can be re-inserted; the account itself is an ordinary user
row with an `auth.identities` row beside it, which is what makes password
sign-in work.

To remove it entirely, delete the user; every table cascades from the studio.

```sql
delete from auth.users where email = 'demo@studio-flows.com';
```
