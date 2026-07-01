# Handoff: [PRODUCT] Pre-Launch Marketing Site

> **Find-and-replace `[PRODUCT]`** with the real product name once chosen. It appears in the nav, hero, footer, section eyebrows, and copyright.

## Overview
A pre-launch marketing site for a connected **pre-production hub for boutique commercial production studios** (food, beverage, CPG, brand commercial work). The product pulls a job's briefs, creative assets, versions, approvals, client communication, and CRM into one organized home, and connects to the tools studios already use instead of replacing them.

The site's job: make a boutique studio operator immediately feel "this was built for me," establish credibility (operator-built, 15 years in commercial production), and capture early interest (waitlist / early-access signup + request-a-demo).

Voice: direct, confident, no fluff — an operator talking to a peer, not a marketing department.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, motion, and behavior. They are **not production code to copy directly**.

The task is to **recreate this design in your target codebase's environment** (React, Vue, Svelte, etc.) using its established component patterns, styling system, and conventions. If no front-end environment exists yet, choose the most appropriate framework for a marketing site (e.g. Next.js / Astro) and implement there.

The prototype is authored as a single "Design Component" HTML file with inline styles and a small vanilla-JS class for theme toggling and scroll-reveal animation. Treat the inline styles as the **spec**, not the recommended implementation — port them to your styling system (CSS modules, Tailwind, styled-components, design tokens, etc.).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, motion, and copy. Recreate the UI faithfully. All color is defined in **OKLCH** via CSS custom properties (see Design Tokens) for a full light/dark, token-first system — preserve that token structure.

## Visual Direction
Energetic, colorful, playful — in the spirit of Monday.com but on the refined side. Key principles:
- **Color is meaningful, not decorative.** A vibrant multi-hue palette, but every color signals something — status, category, or priority. Saturated and joyful, with strong structure underneath so it never tips into noise.
- **Show, don't tell.** Feature sections render real-feeling pieces of the product UI demonstrating each capability, rather than text cards describing features. The product is the hero of every section.
- **Alive.** Sections reveal on scroll (directional), and product moments build (a card drops into "Delivered," a new version appears tagged NEW, client sign-off checks off). Tasteful hover lift on cards/buttons.
- **Varied rhythm.** Layouts alternate: text-left/product-right, then reversed, then a full-bleed centered highlight band, etc. Nothing reads as a repeating stack.
- Typography and whitespace carry the hierarchy. Rounded, friendly shapes. Bright airy surfaces so saturated color pops against air.

## Type System
- **Display / headings:** `Plus Jakarta Sans` (weights 600/700/800). Tight letter-spacing on large headings (≈ -0.03em).
- **Body / UI:** `Hanken Grotesk` (400/500/600/700).
- No slab serif, no monospace, no Inter/Roboto. Load via Google Fonts.

Heading scale uses fluid `clamp()`:
- H1 (hero): `clamp(40px, 5.8vw, 74px)`, weight 800, line-height 1.02, letter-spacing -0.03em
- H2 (section): `clamp(31px, 4vw, 48px)`, weight 800, letter-spacing -0.028em, line-height ~1.04
- Body lead: `clamp(16.5px, 1.3vw, 19px)`, line-height 1.55–1.6
- Eyebrow pills: 12.5px, weight 700, letter-spacing 0.02em
- Small labels: 11px, weight 700, uppercase, letter-spacing 0.04–0.05em

## Layout System
- Max content width **1180px** (hero/app mockup use 1180–1200px), centered, with horizontal padding `clamp(20px, 4vw, 40px)`.
- Vertical section padding `clamp(56px, 8vw, 104–110px)`.
- 8px spacing rhythm.
- Fully fluid/responsive via `clamp()`, `grid-template-columns: repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, and `flex-wrap` — collapses to single column on mobile with no hard breakpoints. Wide product mockups sit in `overflow-x: auto` wrappers so they scroll horizontally on small screens instead of breaking.
- Alternating sections use `background: var(--surface)` vs `var(--bg)` to create rhythm.

## Theme System (token-first, light + dark)
- Theme is set via a `data-theme="light|dark"` attribute on the root wrapper; follows system preference (`prefers-color-scheme`) by default with a **manual toggle** (sun/moon button in the header). Toggle choice persists in `localStorage` under key `mk_theme`.
- The brand accent is set via `data-accent` on the same root. Default **indigo**; swappable to purple / pink / blue / orange. Each accent maps `--accent`, `--accent-soft`, `--accent-strong`, `--accent-fg` off the corresponding hue token.

## Design Tokens (exact OKLCH values)

### Light theme (`:root`, `[data-theme="light"]`)
```
--bg: oklch(0.987 0.005 280);
--surface: oklch(1 0 0);
--surface-2: oklch(0.975 0.008 285);
--text: oklch(0.255 0.035 282);
--text-muted: oklch(0.52 0.03 282);
--text-faint: oklch(0.66 0.025 282);
--border: oklch(0.92 0.011 285);
--border-strong: oklch(0.855 0.016 285);
--shadow-sm: 0 1px 2px rgba(40,30,70,.06), 0 1px 1px rgba(40,30,70,.04);
--shadow-md: 0 4px 10px -3px rgba(40,30,70,.12), 0 2px 4px -2px rgba(40,30,70,.08);
--shadow-lg: 0 2px 4px rgba(40,30,70,.04), 0 30px 60px -18px rgba(60,40,110,.26);
```
Hue tokens (each has a saturated foreground and a soft `-bg` tint):
```
--h-purple: oklch(0.55 0.23 305);   --h-purple-bg: oklch(0.95 0.055 305);
--h-indigo: oklch(0.565 0.205 274); --h-indigo-bg: oklch(0.95 0.05 274);
--h-blue:   oklch(0.605 0.17 245);  --h-blue-bg:   oklch(0.945 0.055 245);
--h-cyan:   oklch(0.68 0.13 210);   --h-cyan-bg:   oklch(0.95 0.06 210);
--h-green:  oklch(0.665 0.165 158); --h-green-bg:  oklch(0.94 0.085 158);
--h-yellow: oklch(0.81 0.15 88);    --h-yellow-bg: oklch(0.955 0.08 88);
--h-orange: oklch(0.705 0.18 50);   --h-orange-bg: oklch(0.95 0.07 50);
--h-pink:   oklch(0.655 0.225 352); --h-pink-bg:   oklch(0.95 0.06 352);
--h-red:    oklch(0.625 0.225 22);  --h-red-bg:    oklch(0.95 0.06 22);
```

### Dark theme (`[data-theme="dark"]`)
```
--bg: oklch(0.185 0.022 282);
--surface: oklch(0.225 0.022 282);
--surface-2: oklch(0.265 0.024 282);
--text: oklch(0.965 0.012 282);
--text-muted: oklch(0.73 0.02 282);
--text-faint: oklch(0.57 0.02 282);
--border: oklch(0.33 0.022 282);
--border-strong: oklch(0.43 0.026 282);
--shadow-sm: 0 1px 2px rgba(0,0,0,.4);
--shadow-md: 0 4px 12px -3px rgba(0,0,0,.5);
--shadow-lg: 0 2px 6px rgba(0,0,0,.35), 0 36px 70px -20px rgba(0,0,0,.72);
```
Dark hue tokens (lighter foregrounds, deeper `-bg` tints):
```
--h-purple: oklch(0.71 0.19 305);  --h-purple-bg: oklch(0.37 0.10 305);
--h-indigo: oklch(0.685 0.17 274); --h-indigo-bg: oklch(0.37 0.10 274);
--h-blue:   oklch(0.71 0.15 245);  --h-blue-bg:   oklch(0.37 0.10 245);
--h-cyan:   oklch(0.79 0.12 210);  --h-cyan-bg:   oklch(0.37 0.085 210);
--h-green:  oklch(0.78 0.155 158); --h-green-bg:  oklch(0.38 0.10 158);
--h-yellow: oklch(0.86 0.14 88);   --h-yellow-bg: oklch(0.42 0.10 88);
--h-orange: oklch(0.78 0.16 50);   --h-orange-bg: oklch(0.39 0.11 50);
--h-pink:   oklch(0.75 0.20 352);  --h-pink-bg:   oklch(0.38 0.11 352);
--h-red:    oklch(0.71 0.20 22);   --h-red-bg:    oklch(0.38 0.11 22);
```

### Accent mapping (per `[data-accent]`)
```
indigo (default): --accent: var(--h-indigo); --accent-soft: var(--h-indigo-bg);
                  --accent-strong: color-mix(in oklch, var(--h-indigo) 84%, #000);
                  --accent-fg: oklch(0.99 0.01 274);
purple / pink / blue / orange follow the same pattern off their hue tokens.
```

### Radii
Buttons/inputs 10–13px · cards 14–22px · CTA band 28px · pills 999px · icon tiles 8–13px · avatars 50%.

## Sections (top to bottom)

1. **Header / nav** — logo (gradient indigo→purple rounded square + 3-bar mark) left; nav links ("How it works", "Why [PRODUCT]"), theme toggle, and primary "Get early access" button right. Sticky-feeling, sits over a soft multi-color blurred blob background. Nav links and button lift/recolor on hover.

2. **Hero** (centered) — green-dot eyebrow pill with "Early access" tag → H1 "Every brief, version & approval, in **one home**." (accent word has a soft underline highlight bar) → operator-voiced subhead → 4 multi-color **category chips** (Food/orange, Beverage/cyan, CPG/green, Brand film/purple) → primary "Get early access" + secondary "Request a demo" → founder credibility line. Below: a large **product mockup** of the project home (rises in on load) — sidebar with active jobs (colored dots), project header with status pill + colored avatar stack, tabbed nav (Approvals tab has a red "1" badge), an asset grid where each asset's preview area is tinted by status hue (Boards/green, Hero cut/orange, Pack shots/blue, Lifestyle/pink) with version tags, a Production status row, a "Needs you" red callout with pulsing dot, an "AI assist" gradient card, an activity feed, and an "AI Video workflow — On the roadmap" footer strip.

3. **Problem** — red eyebrow, headline "You're the human glue holding every job together." + lead, then a 4-up grid of colorful pain cards (Briefs buried in email / Versions everywhere / Approvals lost in chat / Billing off on its own), each with a colored icon tile.

4. **Solution** (centered, on `--surface`) — green eyebrow, headline "One connected home for every job — built for commercial production." + lead, then a 3-up row of icon + title + one-liner (Organized by default / Connected, not siloed / Shaped for the work).

5. **Project board** (show-don't-tell; text left / product right) — indigo eyebrow, "Every job, one board." A 4-column kanban (Pre-pro/blue, Shoot/orange, Post/purple, Delivered/green) of real job cards with avatars and status chips. **On scroll:** the Bolt Energy card drops into "Delivered" (`mkDrop`) and a green check badge pops on (`mkCheck`).

6. **Version tracking** (show-don't-tell; product left / text right — reversed) — blue eyebrow, "The latest cut, always on top." A version stack (v4/v3/v2) where **on scroll** v4 drops in highlighted with a "NEW" tag and the header "Approved" pill checks on.

7. **Review & approval** (show-don't-tell; full-bleed centered highlight band with green radial glow) — green eyebrow, "Approvals that never get lost." A review card: left is a video-still panel (play button + pulsing comment pins), right is a sign-off list (Creative lead, Producer, Client). **On scroll** the client's "Approved" check pops on and a green "Fully approved — cleared for delivery" bar slides up.

8. **Connect, don't replace** (text left / integration panel right, on `--surface`) — cyan eyebrow, "It orchestrates the tools you already use." + lead + a green "Keep your stack. Lose the chaos." chip. Right: the [PRODUCT] gradient pill atop a grid of 8 colorful integration tiles (Figma, Drive, Gmail, Frame.io, QuickBooks, Slack, Dropbox, Notion). **Note:** integration icons are generic placeholders — replace with real, properly-licensed brand marks.

9. **Why [PRODUCT]** — purple eyebrow, "Built by an operator, for operators." + a 4-up grid: Built by a studio operator / Opinionated for commercial work / Genuinely easy to use / AI-video workflow (with "On the horizon" tag).

10. **Credibility / founder** (founder image left / text right, on `--surface`) — "Who's building it" eyebrow, "Built by someone who's lived the chaos." + operator bio, then a "Selected brand work" label and a 4-up logo row. Uses **drag-and-drop image slots** (see Assets) for the founder photo and brand logos.

11. **Closing CTA** (full-bleed gradient band, indigo→purple, with pink + cyan radial glows) — "Early access is limited" pill → "Give every job one home." → lead → **email capture form** (email input + "Get early access" button; on submit shows a success line) → "Or request a demo" link.

12. **Footer** — logo, link row (How it works / Why [PRODUCT] / Early access / Request a demo), "© 2026 [PRODUCT]. Built for studios."

## Interactions & Behavior
- **Theme toggle:** sun/moon button flips `data-theme`, persists to `localStorage["mk_theme"]`. Default follows `prefers-color-scheme` and live-updates if the system preference changes while no manual choice is set.
- **Accent swap:** `data-accent` attribute (indigo default). Wire to a tweak/control or hardcode the chosen accent for launch.
- **Scroll reveal:** elements with `data-reveal="up|left|right|none"` start hidden (opacity 0 + 38px directional offset) and transition in (`opacity .8s` + `transform .8s`, easing `cubic-bezier(.2,.7,.2,1)`) when they enter the viewport via `IntersectionObserver` (threshold 0.16, `rootMargin: 0px 0px -7% 0px`). Optional `data-reveal-delay` (ms).
- **Build animations:** elements with `data-anim="<keyframe> <dur> <easing> both"` (+ optional `data-anim-delay`) play when their nearest revealed ancestor fires. Keyframes: `mkDrop` (drop + scale in), `mkCheck` (scale-pop with overshoot), `mkSlideUp`, `mkGrow` (scaleX), `mkLift`, `mkPop`, `mkPulse` (looping attention dot), `mkFloat`, `mkRise`. A 5s safety timeout forces any un-triggered `data-anim` element visible so nothing can stay hidden.
- **Hover:** buttons lift (`translateY(-1 to -2px)`) and darken to `--accent-strong`; cards lift + raise shadow + strengthen border; nav links recolor to accent with a soft background.
- **Email form:** `onSubmit` prevents default and sets a `submitted` flag that reveals a confirmation line. Wire to your real waitlist/CRM endpoint.
- **Respect `prefers-reduced-motion`:** not yet implemented in the prototype — please add a reduced-motion path that skips reveals/builds (render everything visible) in the real build.

## State Management
- `theme`: `'system' | 'light' | 'dark'` — resolved against `prefers-color-scheme`; persisted to localStorage.
- `accent`: one of indigo/purple/pink/blue/orange (prop/attribute).
- `submitted`: boolean for the CTA email form success state.
- Scroll-reveal state is per-element (observed once, then unobserved). Re-implement with an `IntersectionObserver` hook/directive in your framework.

## Assets
- **Icons:** inline SVG (stroke-based, ~stroke-width 2, rounded caps/joins) throughout. Swap for your icon library (Lucide matches the style closely) or keep as inline SVG.
- **Logo / brand mark:** CSS-built (gradient rounded square + three white bars). Replace with the real logo once it exists.
- **Integration logos (Connect section):** generic placeholder SVGs + text labels — **must be replaced with real, licensed brand marks.**
- **Founder photo + brand-work logos (Credibility section):** use a drag-and-drop **image slot** web component (`image-slot.js`, included). In the prototype the user drops their own images and they persist. In production, replace these with real `<img>`/`<picture>` elements fed by the founder's actual photo and client logos. The slots have ids `founder-photo`, `brand-1`…`brand-4`.
- **Fonts:** Plus Jakarta Sans + Hanken Grotesk via Google Fonts.

## Files
- `Marketing Site.dc.html` — the full design prototype (all sections, tokens, theme logic, animation engine). This is the primary reference. It's a "Design Component" file: the markup lives between `<x-dc>` tags with inline styles; the `<script data-dc-script>` block holds the `Component` class (theme + scroll-reveal logic) and its `data-props` (accent/theme options). Read the inline styles as the visual spec.
- `image-slot.js` — the drag-and-drop image placeholder web component used for the founder photo and brand logos (reference for what those slots do; replace with real images in production).
- `support.js` — runtime for the Design Component prototype format. **Not needed in your implementation** — it only exists to run the `.dc.html` file as a standalone prototype. Ignore it when porting.

> Tip: open `Marketing Site.dc.html` in a browser to see the live design, motion, and both themes before you start porting.
