"use client";

// Fixture: the real shot blocking editor on a template, with nothing saved.
// ?t=road|city|interior|product|desert|stage picks the template, and
// ?all=1 lays out every catalogue piece in rows, ?gest=1 lines up a person
// doing each gesture, both for checking the drawings. ?send=1 adds a pretend pipeline so the Send window opens (sending fails
// here, since a session cannot reach Supabase). ?ai=1 opens a scene laid out
// by the connector's create_blocking_scene from a written description, and
// ?look= opens in a chosen look. /dev pages
// are public in development and auth-gated in production.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BLOCK_KINDS, GESTURES, newObject, type BlockScene } from "@/lib/blocking/scene";
import { TEMPLATES } from "@/lib/blocking/templates";
import { BlockingStudio } from "@/components/blocking/blocking-studio";
import { buildBlockingScene } from "@/lib/connector-blocking";
import { STUDIO_VARS } from "@/components/blocking/ui";

/** The kind of call an assistant makes: a street, a meeting, a push in. */
const AI_EXAMPLE = {
  name: "Corner meet", duration: 8, aspect: "16:9",
  environment: { ground: "asphalt", sky: "golden" },
  objects: [
    { kind: "road", x: 0, z: 0, facing: 90, size: [10, 0.02, 120] },
    { kind: "sidewalk", x: 0, z: -6.5, facing: 90, size: [3, 0.12, 120] },
    { kind: "shopfront", x: -4, z: -11, size: [8, 4.5, 6] },
    { kind: "shopfront", x: 5, z: -11, size: [8, 4.5, 6] },
    { kind: "bench", x: 1.5, z: -7.2 },
    { kind: "lamppost", x: -1.5, z: -5.4, facing: 180 },
    { kind: "bush", x: 3.4, z: -7.6 },
    { ref: "sam", kind: "person", name: "Sam", x: 2.2, z: -6.6, face_toward: "jo", hair: "curly", build: "broad",
      gestures: [{ gesture: "wave", at: 2, until: 4 }, { gesture: "open", at: 6.5 }] },
    { ref: "jo", kind: "person", name: "Jo", x: -6, z: -6.3, pose: "walking", hair: "bun", height: 1.66,
      moves: [{ t: 6.5, x: 1.2, z: -6.4 }] },
    { kind: "car", x: -9, z: -3.8, facing: 90, name: "Parked car", color: "#6f9bd8" },
  ],
  camera: { lens: 40, keys: [{ t: 0, x: -1, y: 1.6, z: 1, look_at: [-1, 1.5, -6.5] }], move: { preset: "push", target: "sam", start: 4, duration: 4 } },
};

function Inner() {
  const q = useSearchParams();
  const tp = TEMPLATES.find((x) => x.id === q.get("t")) ?? TEMPLATES[0];
  // Made once, in the browser: a template mints fresh ids each time it runs.
  const [scene, setScene] = useState<BlockScene | null>(null);
  useEffect(() => {
    const s = tp.make();
    if (q.get("all")) {
      const kinds = BLOCK_KINDS.filter((k) => k.category !== "environment" && !["skyscraper", "warehouse", "room"].includes(k.kind));
      s.objects = kinds.map((k, i) => newObject(k.kind, [(i % 10) * 7 - 31, 0, -Math.floor(i / 10) * 9 - 6], 0, []));
    }
    const kd = BLOCK_KINDS.find((k) => k.kind === q.get("kind"));
    if (kd) {
      const o = newObject(kd.kind, [0, 0, 0], 0, []);
      const d = Math.max(kd.size[0], kd.size[1], kd.size[2]) * 1.9 + 1.2;
      s.objects = [o];
      s.camera = { ...s.camera, aim: { target: o.id, frame: [0, 0] }, keys: [{ ...s.camera.keys[0], p: [d * 0.55, kd.size[1] * 0.5 + d * 0.35, d * 0.8] }] };
    }
    const one = GESTURES.find((g) => g.id === q.get("gest"));
    if (one) {
      const o = newObject("person", [0, 0, 2.5], Number(q.get("yaw") ?? 25), []);
      o.keys = [{ ...o.keys[0], g: [1, 0], ...(one.id === "reach" ? {} : { gk: one.id }) }];
      const b = q.get("build");
      const h = q.get("hair");
      if (b) o.build = b as typeof o.build;
      if (h) o.hair = h as typeof o.hair;
      if (q.get("child")) { o.kind = "child"; o.size = [0.35, 1.2, 0.22]; }
      s.objects = [o];
    } else if (q.get("gest")) {
      s.objects = GESTURES.map((g, i) => {
        const o = newObject("person", [(i % 8) * 1.4 - 4.9, 0, -Math.floor(i / 8) * 2.5 - 3], 0, []);
        o.name = g.name;
        o.keys = [{ ...o.keys[0], g: [1, 0], ...(g.id === "reach" ? {} : { gk: g.id }) }];
        return o;
      });
    }
    // ?gait=<m/s> is one person crossing frame at that speed, filmed side on,
    // for judging a walk or a run (&back=1 films them from behind).
    const gv = Number(q.get("gait"));
    if (gv > 0) {
      const len = 8;
      const x0 = (-gv * len) / 2;
      const o = newObject(q.get("child") ? "child" : "person", [x0, 0, 0], 90, []);
      o.keys = [
        { t: 0, p: [x0, 0, 0], r: [90, 0, 0], ease: "linear" },
        { t: len, p: [-x0, 0, 0], r: [90, 0, 0], ease: "linear" },
      ];
      s.objects = [o];
      const back = !!q.get("back");
      const cp = (x: number): [number, number, number] => (back ? [x - 4.5, 1.3, 0.6] : [x, 1.0, 5.5]);
      s.camera = { ...s.camera, parent: null, aim: { target: null, frame: [0, 0] }, flow: "keys", keys: [
        { t: 0, p: cp(x0), r: [back ? -90 : 0, -2, 0], lens: back ? 40 : 30, ease: "linear" },
        { t: len, p: cp(-x0), r: [back ? -90 : 0, -2, 0], lens: back ? 40 : 30, ease: "linear" },
      ] };
      s.duration = len;
    }
    // ?look=blockout|clay|lit opens in that look, for comparing them.
    const look = q.get("look");
    const withLook = (x: BlockScene): BlockScene => (look === "blockout" || look === "clay" || look === "lit" ? { ...x, look } : x);
    if (q.get("ai")) {
      const r = buildBlockingScene(AI_EXAMPLE);
      if (!("error" in r)) { setScene(withLook(r.scene)); return; }
    }
    setScene(withLook(s));
  }, [tp, q]);
  if (!scene) return null;
  return (
    <div data-theme="dark" className="fixed inset-0 bg-bg"
      style={STUDIO_VARS}>
      <BlockingStudio initial={scene} canEdit onChange={() => {}}
        describe={q.get("bar") ? async (_prompt, cur) => {
          // A pretend answer, since a session has no AI key: the same builder
          // the real bar runs, on a canned edit, after a short wait.
          await new Promise((r) => setTimeout(r, 900));
          const r = buildBlockingScene({
            summary: "Added a cyclist riding past behind the lead and pushed in on her for the last three seconds.",
            objects: [
              { ref: "cyc", kind: "bike", name: "Cyclist", x: 3.5, z: -14, moves: [{ t: cur.duration, x: 3.5, z: 10 }] },
              { ref: "rider", kind: "person", name: "Rider", rides_with: "cyc", x: 0, y: 0.55, z: -0.1, pose: "seated" },
              { kind: "unicorn", name: "Unicorn" },
            ],
            camera: { move: { preset: "push", target: cur.objects[0]?.name ?? "", start: Math.max(0, cur.duration - 3), duration: 3 } },
          }, cur);
          return "error" in r ? r : { scene: r.scene, summary: "Added a cyclist riding past behind the lead and pushed in on her for the last three seconds.", skipped: r.skipped };
        } : undefined}
        pipeline={q.get("send") ? {
          projectId: "00000000-0000-0000-0000-000000000001",
          studioId: "00000000-0000-0000-0000-000000000002",
          sceneId: "00000000-0000-0000-0000-000000000003",
          shots: [{ id: "s1", label: "Shot 1, Coast chase" }, { id: "s2", label: "Shot 2, Dog at the window" }],
          linkedShotId: "s2",
        } : undefined} />
    </div>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
