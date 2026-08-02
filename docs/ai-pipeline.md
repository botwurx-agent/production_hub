# AI film/video generation pipeline — architecture spec

Status: **Slice 1 BUILT + deployed.** Roadmap Phase 7 (the forward-looking
differentiator). This is the spec we build slices against. Clickable mockups
exist (published as Claude artifacts; the red-annotated flow is the reference).

### Slice 1 (built, migration 0045) — what shipped
- Tables: ai_scripts, ai_shots (method generated|live + stage), ai_prompts
  (versioned per shot+stage), ai_generations (image candidates + video takes
  with full provenance + start/end/take roles + parent-frame lineage).
- Page /projects/[id]/pipeline (linked from the hub Visualize band): two-pane
  binder = left shot list (+ script editor, + Generated/Live shot), right the
  active shot's flow. For a generated shot: Image stage (prompt + target model
  + add candidates with spec + approve Start/End + per-generation spec card +
  reject/restore) then Video stage (prompt + add takes, auto-linked to the
  approved Start/End frames + pick take). Live shots show a "use the standard
  shot tools" note (deeper live linking later).
- pipeline-actions.ts: script/shot/prompt/generation CRUD + role/status.
- Every generation captures platform, model(+version), seed, aspect/res/fps/
  duration/guidance/cost, free params (notes/negative prompt/LoRA/etc.),
  generated-by, and (video) parent start/end ids.
- NOT yet: media upload to storage (uses external URL for now), a top-level
  "all shots" board/timeline, internal/client review gates wired to the review
  portal, prompt versioning UI, drag-reorder. See phasing.

## Guiding principles
- **Organize, don't generate.** The Hub is the control surface over an exploding
  set of generations; the actual generating stays on the external platforms
  (Nano Banana / image models, Kling / Veo / Runway / Sora / video models). We
  import, link, organize, track, and route for approval. Architected
  connection-ready so generation APIs can plug in later without a rebuild.
- **Provenance is the moat.** Every frame and clip traces back to the prompt,
  model, seed/params, and parent assets that produced it. Nothing is lost across
  hundreds of generations. Same "nothing gets lost" philosophy as Versions.
- **Non-destructive.** Regenerating never deletes; rejected candidates stay in
  the shot's history.
- **Future-proof for 2027/2028.** Models and even pipeline *stages* will keep
  changing fast, so stages are data-driven / model-agnostic, not hardcoded to
  today's script -> image -> video flow.

## The foundational decision: one Project, method per Shot, hybrid-native
An AI job is still fundamentally a production (client, brief, script, internal
review, client rounds, post, delivery, revisions, budget, comms). So it is NOT a
separate section. It is the **same Project object and the same spine** (Lead ->
Client -> Project -> Brief -> Review -> Delivery -> Comms -> Billing, all reused).
Only the **Visualize band** of the workspace adapts to run the generation
pipeline instead of / alongside storyboards + shot list.

Crucially, **production method is a property of each Shot, not a label on the
whole project.** A shot is either **Generated** (carries the generation lineage)
or **Live/Captured** (carries shot-list / storyboard / call-sheet detail). One
project, one sequence, one client review, one delivery can therefore be all-AI,
all-live, or **hybrid** (live plates + generated shots in the same job) — which
is where commercial work is heading. The project may carry a light
`production_method` (live | ai | hybrid) that only tailors which cards surface;
it is never a hard wall.

## The pipeline (stages + gates)
```
SCRIPT -> SHOT BREAKDOWN -> IMAGE STAGE -> VIDEO STAGE -> POST -> DELIVERY
                            (gate: pick    (gate: pick    (gate:  (gate:
                             start+end)     the take)      internal client
                                                           approve) rounds)
```
Each arrow is an approval gate. Between them is heavy fan-out (hundreds of
images, hundreds of takes). The design tames fan-out and makes each gate fast.

## The spine unit: the Shot, with a per-shot lineage tree
Everything hangs off a Shot; you never browse loose generations. A generated
shot owns its whole lineage:
```
Shot 02 "Hero pours the drink, slow-mo"  [Generated]
  |- script beat
  |- Image stage:  image prompt v1 -> [batch of candidates]  (triage)
  |                image prompt v2 -> [batch of candidates]  (triage)
  |                approved: START frame + END frame
  |- Video stage:  video prompt (refs approved start+end) -> [batch of takes]
  |                approved take
  |- Post -> Delivery -> client rounds
```
Two organizing axes, both needed: by **shot** (production structure) and by
**batch** (one round of N generations from one prompt, where triage happens).

## Data model (sketch; connection-ready, additive)
- **Script**: versioned document per project; AI-assist to draft/punch-up later.
  Decomposes into shots.
- **Shot / segment**: the atomic unit. order, title, script beat, duration,
  `method` (generated | live), current stage + gate state. A new richer entity
  than the lightweight `shot_cards`; a shot can optionally link to a shot-list
  row so the two stay in sync rather than duplicate.
- **Prompt**: first-class and **versioned** (not a bare text field). text, target
  model/platform, params, stage (image | video). Reusable via a **prompt
  library** (style tokens carried across shots for look consistency).
- **Generation (candidate)**: every generated image/video, stored as an
  **Asset + Version** (reuse existing storage + version machinery), tagged with
  shot, stage, source prompt, status (candidate | approved | rejected). A video
  candidate also records its **parent start/end images** — the lineage link.
  Carries the full **provenance/spec** (below). Nullable `source`/external-ref
  fields per the connection-ready rule.

### Provenance / spec — captured on EVERY generation (non-negotiable)
In AI video, generations bounce across models, platforms, seeds, and params, and
multiple people touch one job. So each image and take must carry its own
complete, self-describing record — no mystery clips, everything reproducible.
Fields (image + video share most; video adds refs/motion):
- platform / model + model version (e.g. Nano Banana 2 Pro, Midjourney v7, Flux
  1.1 for images; Kling 2.1, Veo 3, Runway, Sora for video) — candidates in one
  batch can come from DIFFERENT platforms; store per generation, not per shot.
- prompt reference + prompt version used.
- seed.
- params: aspect ratio, resolution, guidance/stylize/steps (image); duration,
  fps, resolution, motion/camera settings, seed (video).
- reference frames (video only): the start + end image ids (lineage).
- generated_by (user) + created_at — multi-person attribution.
- source: external link / file ref to the generation on its platform.
- optional: cost/credits.
- status + approved_by + approved_at.
UI: a compact model/platform badge on every thumbnail; a full spec card on
select. This provenance is the moat and the thing that keeps a multi-person,
multi-model project sane.
- **Gate / approval**: explicit state transitions, internal (team) then client.
  **Reuse the existing review portal** (Frame.io pins + timecode + share link) —
  the approval infra already exists.
- **Stage definition (later)**: stages-as-data so the pipeline shape can evolve
  without a rebuild.

## UX surfaces (see the mockup)
1. **Sequence** — the spine; every shot in order with method badge + stage/gate
   state. The "where is everything" board.
2. **Shot cockpit** — one shot's lineage made interactive: script beat -> image
   prompt(s) + candidate batches -> approved start/end pair -> video prompt(s) +
   takes -> approved take, with a right rail of gates + provenance + lineage.
3. **Triage** — the fan-out fast lane: a batch in a grid with keyboard
   approve/reject/star, start/end tagging, compare, filter by prompt/model/status.
4. **Prompt library** — reusable, versioned prompts + style tokens.
5. **Sequence / timeline** — the film assembled from approved takes; handoff to
   post; the "does it cut together" view.
6. **Client review** — reuse the existing portal for revision rounds.

## Build phasing (slices)
0. Spine + data model (script -> shots w/ method) + the Sequence board.
1. Image stage: prompt(s) + candidate batch (import/upload) + triage + approve
   start/end pair. (The core loop; build first.)
2. Video stage: video prompt referencing approved images + takes batch + triage
   + approve take.
3. Post + delivery + client review (reuse portal).
4. Provenance/lineage views, prompt library, model metadata, filters at scale.
5. Later: direct generation-API connectors (image + video platforms).

## Open items to confirm as we slice
- Exact first-slice scope (recommended: spine + Sequence board + image-stage
  triage core loop).
- How a Shot links to the existing `shot_cards` / `storyboard_frames` (share vs
  reference).
- Reference-image flexibility (0 / 1 / 2+ refs) per video model.
- Which generation platforms to prioritize for the eventual connectors.

---

# The cast layer: characters, elements, looks (SPEC, not yet built)

Added 2026-08-01, from a real job. The pipeline can say "this take came from
those two images". It cannot say "Maya is in shots 1, 4 and 7, wearing the grey
tee and the gold ring in all three". That second sentence is what keeps a
generated spot from drifting, and nothing in the schema can express it today.

## What is actually missing

`ai_generation_refs` (0063) models lineage between anonymous media with a role
(`character`, `style`, `element`, `motion`). There is no named, persistent
*Maya*. Three consequences:

- `ai_generations.shot_id` is `not null`, so every reference belongs to one
  shot. A character in six shots is uploaded six times or hand-picked from
  another shot each time.
- No wardrobe concept, so "what is she wearing in scene 4" lives in someone's
  head.
- No way to ask which shots an entity appears in, so continuity cannot be
  checked, only remembered.

The missing layer is not storage. It is that the pipeline has **no cast**.

## The three tiers, from the operator's real sheets

The artifacts a job actually produces, in the order they are made:

1. **Identity.** `@maya`: four views (full front, face, three-quarter, profile)
   in a deliberately neutral base outfit. This is who she is, wardrobe-free.
2. **Garments, itemised.** `@mayawardrobe`: a flat-lay sheet where every piece
   carries its own code. WD-01 grey tee, WD-10 dark shorts, WD-A1 gold ring,
   WD-A2 gold studs. The itemisation is the important part and it is already how
   the operator works.
3. **The combined sheet.** `@mayawithwardrobescene1`: identity wearing that
   wardrobe, re-rendered in the same four-view format. **This is the artifact
   actually referenced when generating the scene**, and it is *derived* from the
   first two.

Tier 3 being derived is the load-bearing observation: it is a generation whose
inputs are tiers 1 and 2, which is exactly what `ai_generation_refs` already
models. We are not inventing a mechanism, we are pointing an existing one at
named entities.

## Model

**`ai_entities`** — the cast and contents of a job.
`studio_id`, `project_id` (NULLABLE: null means studio-wide, for a recurring
mascot or spokesperson, the same convention `ai_prompt_library` already uses),
`kind`, `name`, `slug`, `description`, `notes`, `archived_at`.

`kind` is one of:
- `character` — identity-locked. A person the audience must recognise.
- `element` — a garment, prop, product, or anything that must be exact. WD-01
  and WD-A1 are elements, and so is the hero bottle.
- `location` — a set or place, carrying its scout sheet.
- `crowd` — background extras. See below; deliberately not identity-locked.

**`ai_looks`** — a named state of an entity. "Scene 1 casual" on a character;
"empty" versus "full" on a bottle; "golden hour" on a location.
`entity_id`, `name`, `slug`, `description`, `position`.

**`ai_look_items`** — a look is a **composition**, not a container.
`look_id`, `item_entity_id`, `position`. So the ring is one entity referenced by
every look it appears in, and "which scenes is the ring in" is a query rather
than an archaeology exercise.

**`ai_shot_cast`** — the join everything hangs off.
`shot_id`, `entity_id`, `look_id` (nullable), `notes`, `position`. Reads as
"Maya, in her scene 1 look, appears in shot 4". Naturally handles several talent
in one shot, because it is a join and always was.

**`ai_entity_handles`** — the platform identifiers.
`entity_id` OR `look_id` (exactly one), `platform`, `handle`, `external_id`,
`account_ref`, `verified_at`.

A handle is **recorded external state, not a slug we invent**. It is the string
Higgsfield gave back when the element was uploaded, and the prompt only resolves
if we emit it exactly. Both levels need one, because the operator uploads the
wardrobe as its own element and gets its own `@name` for it. It is per platform
because the same Maya is a different handle elsewhere, and `account_ref` exists
because handles die the day you move accounts.

**Media.** Make `ai_generations.shot_id` NULLABLE and add `entity_id` +
`look_id`, with a check that exactly one owner is set (the same one-owner shape
`email_threads` uses). Character sheets then inherit storage, provenance, link
import, triage and review rather than duplicating all of it in a parallel table.
Existing queries all filter by `shot_id`, so entity-owned rows simply never
match them: the change is additive in practice.

## Naming rules, decided now because handles are expensive to change later

- **Name the look, not the scene.** `@maya_wd1`, never
  `@mayawithwardrobescene1`. The moment that outfit reappears in scene 4 a
  scene-bound name either forces a duplicate sheet or starts lying. Where it
  appears is the shot assignment's job.
- **Normalise on write.** Lowercase, `[a-z0-9_]`. The operator's own three
  examples already disagree on casing, and these are literal strings going into
  prompts.
- **Refuse collisions** within a project and platform rather than allowing two
  near-identical handles to coexist.
- The stored `slug` is ours (search, prompt composition, display). The `handle`
  is theirs. Keep them separate even when they match.

## Extras are deliberately different

A background extra must NOT be identity-locked. You want three plausible people,
not the same face three times, which is the classic generated-video tell. So a
`crowd` entity carries a description and a count, has no character sheet, and
the linter must never flag it for a missing handle. Modelling extras as
characters with missing sheets would produce constant false alarms and train the
operator to ignore every warning, including the real ones.

## The continuity grid

Entities down the side, shots across the top, the look in each cell. This is the
wardrobe continuity board live action has always kept, and it is the reason to
open the feature at all. It makes four errors visible at a glance:

- a character assigned to a shot with no look chosen
- an entity with no sheet, so it exists only as prose
- an entity with no handle on the platform being targeted
- the same character in different looks in adjacent shots, which is either a
  deliberate change or the bug this whole layer exists to catch

## Prompt composition and the linter

When writing a shot's prompt, the cast assigned to that shot appears as
click-to-insert chips carrying the **real handles for the target platform**, so
nobody types `@maya` from memory. Three warnings, in order of how quietly they
fail:

1. An entity assigned to the shot that the prompt never references.
2. A handle in the prompt belonging to nothing in this shot. Usually a typo, or
   a leftover from the shot the prompt was copied from.
3. **An entity with no handle on the target platform.** The silent one. The
   prompt reads perfectly, the element was never uploaded, and the model
   improvises the wardrobe. Nobody notices until the client does.

The entity's `description` is the fallback for platforms without element
support, and the UI should say so, so prose is never trusted where a handle was
needed.

## Import stays anchored to the shot, not the filename

Higgsfield returns `hf_20260731_...mp4`; our naming does not survive the round
trip. The importer already targets the shot being viewed, so a generation
inherits that shot's cast and looks automatically. No filename parsing required.
Handles earn their place in the prompt, in search, and as a fallback when a
batch arrives unsorted, not as the matching key.

## Slices

1. Entities, looks, composition, shot assignment, handles, entity-owned media,
   and **the continuity grid**. The grid ships first because without it this is
   data entry with no payoff.
2. Prompt composition from the assigned cast, plus the three-warning linter.
3. Derived sheet flow: generate the combined look sheet from identity plus
   garments, recording lineage through the existing `ai_generation_refs`.
4. Later, agent-mediated: read the platform's element library (Higgsfield
   exposes a way to list reference elements) and reconcile handles instead of
   typing them.

## Open

- Whether a `location` needs its prop list modelled as looks or as a plain set
  of associated element entities. Leaning plain set; a location's "props" are
  not states of the location.
- Whether `crowd` needs a count field or whether that belongs in the shot
  assignment's notes. Leaning count on the assignment, since it varies per shot.
