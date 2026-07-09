# AI film/video generation pipeline — architecture spec

Status: **design agreed, not built.** Roadmap Phase 7 (the forward-looking
differentiator). This is the spec we build slices against. A clickable mockup of
the three core views exists (published as a Claude artifact; ask the operator
for the link).

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
