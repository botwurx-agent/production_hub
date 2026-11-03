"use client";

import { useEffect, useState } from "react";
import { PipelineMap } from "@/components/production/pipeline-map";
import { parsePositions, type MapGeneration, type MapInput, type MapPositions } from "@/lib/pipeline-map";

// Drawn stand-ins, obviously not screenshots.
const pic = (label: string, a: string, b: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="232" cy="62" r="34" fill="rgba(255,255,255,.35)"/><path d="M0 150 Q80 110 160 140 T320 128 V180 H0Z" fill="rgba(0,0,0,.22)"/><text x="14" y="166" font-family="sans-serif" font-size="18" font-weight="bold" fill="#fff">${label}</text></svg>`
  );

let t = 0;
const g = (id: string, shot: string, kind: "image" | "video" | "audio", extra: Partial<MapGeneration> = {}): MapGeneration => ({
  id,
  shot_id: shot,
  stage: kind,
  kind,
  status: "candidate",
  role: null,
  starred: false,
  platform: "Higgsfield",
  model: kind === "video" ? "seedance_2_5" : kind === "audio" ? "elevenlabs_v3" : "nano_banana_2",
  prompt: null,
  parent_start_id: null,
  parent_end_id: null,
  created_at: new Date(Date.UTC(2026, 9, 1, 0, t++)).toISOString(),
  ...extra,
});

const INPUT: MapInput = {
  shots: [
    { id: "s1", position: 0, title: "Sunrise over the lake", status: "approved", method: "generated", stage: "video", input_mode: "frames" },
    { id: "s2", position: 1, title: "Can cracks open, slow motion", status: "in_progress", method: "generated", stage: "video", input_mode: "image_to_video" },
    { id: "s3", position: 2, title: "Maya runs the jetty", status: "in_progress", method: "generated", stage: "video", input_mode: "video_to_video" },
    { id: "s4", position: 3, title: "Friends at the dock", status: "in_progress", method: "generated", stage: "image", input_mode: "frames" },
    { id: "s5", position: 4, title: "End card", status: "in_progress", method: "generated", stage: "video", input_mode: "text_to_video" },
  ],
  elements: [
    { id: "e1", name: "Maya", kind: "character" },
    { id: "e2", name: "Lake house jetty", kind: "location" },
    { id: "e3", name: "Golden Hour can", kind: "element" },
    { id: "e4", name: "Linen summer look", kind: "wardrobe" },
  ],
  uses: [
    { shot_id: "s1", entity_id: "e2" },
    { shot_id: "s2", entity_id: "e3" },
    { shot_id: "s3", entity_id: "e1" },
    { shot_id: "s3", entity_id: "e2" },
    { shot_id: "s3", entity_id: "e4" },
    { shot_id: "s4", entity_id: "e1" },
    { shot_id: "s4", entity_id: "e3" },
    { shot_id: "s4", entity_id: "e4" },
    { shot_id: "s5", entity_id: "e3" },
  ],
  generations: [
    // 1: two frames tagged start/end, two rejected, one take built from both
    g("a1", "s1", "image", { role: "start", status: "approved", prompt: "Wide, mist on the lake, first light breaking over the pines" }),
    g("a2", "s1", "image", { role: "end", status: "approved", prompt: "Same wide, sun clear of the treeline, warm flare" }),
    g("a3", "s1", "image", { status: "rejected" }),
    g("a4", "s1", "image", { status: "rejected" }),
    g("a5", "s1", "video", { role: "take", status: "approved", parent_start_id: "a1", parent_end_id: "a2" }),
    g("a6", "s1", "video", { status: "rejected", parent_start_id: "a1", parent_end_id: "a2" }),
    // 2: one frame, three takes from it, one shortlisted
    g("b1", "s2", "image", { role: "start", status: "approved", prompt: "Macro, condensation beading on the can" }),
    g("b2", "s2", "image", { starred: true }),
    g("b3", "s2", "video", { parent_start_id: "b1", starred: true }),
    g("b4", "s2", "video", { parent_start_id: "b1" }),
    g("b5", "s2", "video", { parent_start_id: "b1", role: "take", status: "approved" }),
    // 3: v2v off a motion reference, with a style reference
    g("c1", "s3", "video", { status: "reference", role: "motion", platform: null, model: null }),
    g("c2", "s3", "image", { status: "reference", role: "style", platform: null, model: null }),
    g("c3", "s3", "video", { starred: true }),
    g("c4", "s3", "video", {}),
    // 4: frames still being chosen
    g("d1", "s4", "image", { starred: true }),
    g("d2", "s4", "image", {}),
    g("d3", "s4", "image", {}),
    g("d4", "s4", "image", { status: "rejected" }),
    // 5: text to video plus the voiceover read
    g("f1", "s5", "video", { role: "take", status: "approved" }),
    g("f2", "s5", "audio", { role: "take", status: "approved", platform: "ElevenLabs", model: "v3" }),
  ],
  refs: [
    { generation_id: "c3", ref_generation_id: "c1", role: "motion" },
    { generation_id: "c3", ref_generation_id: "c2", role: "style" },
    { generation_id: "c4", ref_generation_id: "c1", role: "motion" },
  ],
  cut: { name: "Golden Hour :30", versions: [{ id: "v1", version_number: 1, review: "changes" }, { id: "v2", version_number: 2, review: "pending" }] },
  reviewingShotIds: ["s2"],
};

const PALETTE: [string, string][] = [
  ["#f2b45c", "#c75b39"], ["#7fb6d8", "#2f5f8a"], ["#e9c46a", "#8a5a2b"], ["#9ad1b0", "#2f7a5b"], ["#d6a3c9", "#6d3d78"], ["#f4a261", "#e76f51"],
];
const THUMBS: Record<string, string> = {};
INPUT.generations.forEach((x, i) => {
  const [a, b] = PALETTE[i % PALETTE.length];
  THUMBS[x.id] = pic(x.kind === "audio" ? "VO" : x.id.toUpperCase(), a, b);
});
const EL_THUMBS: Record<string, string> = { e1: pic("", "#d9a07b", "#6b3f2a"), e2: pic("", "#7fb6d8", "#355c45"), e3: pic("", "#f2d06b", "#c7782e"), e4: pic("", "#efe6d2", "#a8957a") };

const KEY = "pipeline.map.fixture";

export function MapFixture() {
  const [positions, setPositions] = useState<MapPositions>({});
  useEffect(() => {
    try {
      setPositions(parsePositions(JSON.parse(localStorage.getItem(KEY) || "{}")));
    } catch {}
  }, []);
  return (
    <PipelineMap
      input={INPUT}
      thumbs={THUMBS}
      elementThumbs={EL_THUMBS}
      cutThumb={pic("v2", "#f2b45c", "#2f5f8a")}
      positions={positions}
      onPositionsChange={(next) => {
        setPositions(next);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
      }}
      onOpenShot={(id) => alert(`Would open shot ${id} in the pipeline`)}
    />
  );
}
