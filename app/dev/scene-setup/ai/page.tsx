"use client";

// Fixture: a scene builder setup laid out by the connector's
// create_scene_setup from a written description, opened in the real builder
// with nothing saved. /dev pages are public in development and auth-gated in
// production.
import { useState } from "react";
import { PrevizPrototype } from "@/components/previz/previz-prototype";
import { buildSceneSetup } from "@/lib/connector-scene";

/** The kind of call an assistant makes: a kitchen, a pour, a key and a fill. */
const EXAMPLE = {
  name: "Kitchen pour",
  aspect: "16:9",
  room: { width: 5.5, depth: 6, height: 3, floor: "wood", walls: ["back", "left"], openings: [{ wall: "left", kind: "window", width: 1.8 }] },
  items: [
    { ref: "island", kind: "island", x: 0, z: -0.4 },
    { kind: "counter", x: 0.4, z: -2.95, width: 3.4 },
    { kind: "wall-cabinet", x: 0.4, z: -3.1, width: 3.4, raise: 1.7 },
    { ref: "glass", kind: "wine-glass", x: 0.15, z: -0.35 },
    { ref: "bottle", kind: "bottle", x: -0.15, z: -0.3 },
    { kind: "pendant", x: 0, z: -0.4, raise: 2.0, dimmer: 50 },
    { kind: "plant", x: 1.9, z: -2.9 },
  ],
  people: [{ ref: "maya", name: "Maya", x: 0.1, z: -1.15, face_toward: "glass", height: 1.68 }],
  lights: [
    { role: "Key", fixture: "ls600d", modifier: "dome", aim_at: "maya", dimmer: 55, diffusion: { material: "half-grid", size_ft: 8, distance: 1.2 } },
    { role: "Fill", fixture: "s60", aim_at: "maya", dimmer: 25 },
    { role: "Back", fixture: "ls300x", aim_at: "maya", dimmer: 40 },
  ],
  grip: [{ kind: "flag", aim_at: "maya", x: -1.4, y: 1.8, z: 0.6 }],
  cameras: [
    { code: "1A", title: "Wide", lens: 32, x: 0.4, y: 1.5, z: 3.2, look_at: "maya" },
    { code: "1B", title: "Pour", lens: 85, stop: 2.8, x: 0.1, y: 1.15, z: 1.4, look_at: "glass", move: { z: 0.8, seconds: 4 } },
  ],
  daylight: { sky: "bright" },
};

export default function Page() {
  const [store] = useState(() => {
    const r = buildSceneSetup(EXAMPLE);
    if ("error" in r) return undefined;
    return { initial: r.setup, save: async () => null, create: async () => {}, canEdit: true };
  });
  return <PrevizPrototype store={store} />;
}
