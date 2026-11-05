"use client";

// Fixture: the real shot blocking editor on a template, with nothing saved.
// ?t=road|city|interior|product|desert|stage picks the template, and
// ?all=1 lays out every catalogue piece in rows, ?gest=1 lines up a person
// doing each gesture, both for checking the drawings. ?send=1 adds a pretend pipeline so the Send window opens (sending fails
// here, since a session cannot reach Supabase). /dev pages
// are public in development and auth-gated in production.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BLOCK_KINDS, GESTURES, newObject, type BlockScene } from "@/lib/blocking/scene";
import { TEMPLATES } from "@/lib/blocking/templates";
import { BlockingStudio } from "@/components/blocking/blocking-studio";
import { STUDIO_VARS } from "@/components/blocking/ui";

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
      s.objects = [o];
    } else if (q.get("gest")) {
      s.objects = GESTURES.map((g, i) => {
        const o = newObject("person", [(i % 8) * 1.4 - 4.9, 0, -Math.floor(i / 8) * 2.5 - 3], 0, []);
        o.name = g.name;
        o.keys = [{ ...o.keys[0], g: [1, 0], ...(g.id === "reach" ? {} : { gk: g.id }) }];
        return o;
      });
    }
    setScene(s);
  }, [tp, q]);
  if (!scene) return null;
  return (
    <div data-theme="dark" className="fixed inset-0 bg-bg"
      style={STUDIO_VARS}>
      <BlockingStudio initial={scene} canEdit onChange={() => {}}
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
