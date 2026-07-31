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

## 1. Put the media in place

The rows reference deterministic storage paths, so the files have to exist or
every thumbnail renders broken.

```bash
node scripts/demo-media.mjs
```

`scripts/demo-media/` holds neutral placeholders. **Replace them with real
stills** of the same filenames and re-run: a screenshot of the product is only
as convincing as the work inside it, and a food and beverage studio showing grey
rectangles undoes the point of showing the product at all. Filenames are listed
at the top of the script.

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
