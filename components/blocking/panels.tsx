"use client";

// Shot blocking: the outliner (what is in the scene) and the properties panel
// (whatever is selected). Both work through the studio's api, so the rule for
// how an edit lands on the timeline lives in one place.
import { useState } from "react";
import {
  BLOCK_ASPECTS, BLOCK_CATEGORIES, BLOCK_KINDS, CAMERA_FLOWS, EASES, LOOKS, SUBJECT_COLORS, blockKind,
  type BlockScene, type Ease, type Environment, type Vec3,
} from "@/lib/blocking/scene";
import { PRESETS, type PresetId } from "@/lib/blocking/keys";
import { BODIES } from "@/lib/previz/optics";
import { POSES } from "@/lib/previz/poses";
import { ControlPads, type PadSpec } from "@/components/previz/move-pad";
import type { KeyRef, Track } from "./timeline";
import { Btn, Num, Row, Section, Seg, Select, Swatches, Vec, useOutside } from "./ui";

/** `af` is the camera's aim framing at that moment (see CamKey). */
export type Posed = { p: Vec3; r: Vec3; lens?: number; af?: [number, number] };

export type CamPadAction =
  | "boomUp" | "boomDown" | "truckLeft" | "truckRight" | "pushIn" | "pullOut"
  | "panLeft" | "panRight" | "tiltUp" | "tiltDown" | "zoomIn" | "zoomOut";

export type StudioApi = {
  scene: BlockScene;
  t: number;
  canEdit: boolean;
  sel: Track | null;
  select: (track: Track | null) => void;
  updateScene: (fn: (s: BlockScene) => BlockScene, coalesce?: string) => void;
  updateObject: (id: string, patch: Partial<BlockScene["objects"][number]>, coalesce?: string) => void;
  writePose: (track: Track, pose: Partial<Posed>, coalesce?: string) => void;
  resetKeyCurve: () => void;
  /** The controller pads: `amt` is seconds at the chosen speed. */
  camPad: (action: CamPadAction, amt: number) => void;
  posed: (track: Track) => Posed;
  addObject: (kind: string) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  setParent: (track: Track, parent: string | null) => void;
  applyPreset: (id: PresetId, target: string | null, len: number) => void;
  drive: (id: string, speed: number, len: number) => void;
  selectedKey: KeyRef | null;
  setKeyEase: (e: Ease) => void;
  speedOf: (track: Track) => { peak: number; travel: number };
};

const KIND_ICON: Record<string, string> = {
  people: "◉", vehicles: "▭", environment: "▲", set: "▦", shapes: "◆",
};

export function Outliner({ api }: { api: StudioApi }) {
  const { scene, sel, select, canEdit } = api;
  const [adding, setAdding] = useState(false);
  const ref = useOutside(adding, () => setAdding(false));
  const groups = BLOCK_CATEGORIES.map((c) => ({ ...c, items: scene.objects.filter((o) => blockKind(o.kind).category === c.id) }))
    .filter((g) => g.items.length);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={ref} className="relative border-b border-border p-2">
        {canEdit && (
          <Btn tone="primary" className="w-full" onClick={() => setAdding((v) => !v)}>+ Add to scene</Btn>
        )}
        {adding && (
          <div className="absolute left-2 right-2 top-11 z-30 max-h-[70vh] overflow-y-auto rounded-[10px] border border-border bg-surface p-2 shadow-2xl">
            {BLOCK_CATEGORIES.map((c) => (
              <div key={c.id} className="mb-2">
                <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{c.name}</p>
                {BLOCK_KINDS.filter((k) => k.category === c.id).map((k) => (
                  <button key={k.kind} type="button" onClick={() => { api.addObject(k.kind); setAdding(false); }}
                    className="flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1 text-left hover:bg-surface-2">
                    <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: k.color }} />
                    <span className="text-[12px] text-text">{k.name}</span>
                    <span className="ml-auto truncate text-[10.5px] text-text-faint">{k.hint}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <Item active={sel === "camera"} onClick={() => select("camera")} color="var(--h-amber)" icon="▶"
          name="Camera" meta={`${scene.camera.keys.length} keys`} />
        {groups.map((g) => (
          <div key={g.id} className="mt-2">
            <p className="px-3 pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{g.name}</p>
            {g.items.map((o) => (
              <Item key={o.id} active={sel === o.id} onClick={() => select(o.id)} color={o.color} icon={KIND_ICON[g.id]}
                name={o.name} meta={o.keys.length > 1 ? `${o.keys.length} keys` : o.parent ? "rides along" : ""}
                dim={o.hidden} indent={!!o.parent}
                onEye={canEdit ? () => api.updateObject(o.id, { hidden: !o.hidden }) : undefined} />
            ))}
          </div>
        ))}
        {!scene.objects.length && (
          <p className="px-3 py-4 text-[12px] leading-relaxed text-text-muted">Nothing in the scene yet. Add people, a vehicle, a road, a room.</p>
        )}
      </div>
    </div>
  );
}

function Item({ active, onClick, color, icon, name, meta, dim, indent, onEye }: {
  active: boolean; onClick: () => void; color: string; icon: string; name: string; meta: string;
  dim?: boolean; indent?: boolean; onEye?: () => void;
}) {
  return (
    <div className={`group flex items-center gap-2 px-2 py-1 ${active ? "bg-accent-soft" : "hover:bg-surface-2"} ${indent ? "pl-6" : ""}`}>
      <button type="button" onClick={onClick} className={`flex min-w-0 flex-1 items-center gap-2 text-left ${dim ? "opacity-45" : ""}`}>
        <span className="w-3 text-center text-[11px]" style={{ color }}>{icon}</span>
        <span className="truncate text-[12px] text-text">{name}</span>
        {meta && <span className="ml-auto shrink-0 text-[10px] text-text-faint">{meta}</span>}
      </button>
      {onEye && (
        <button type="button" onClick={onEye} title={dim ? "Show" : "Hide"}
          className="text-[11px] text-text-faint opacity-0 hover:text-text group-hover:opacity-100">{dim ? "○" : "●"}</button>
      )}
    </div>
  );
}

const LENSES = [14, 18, 24, 28, 35, 50, 85, 135];

export function Properties({ api }: { api: StudioApi }) {
  const { scene, sel } = api;
  if (sel === "camera") return <CameraPanel api={api} />;
  const o = sel ? scene.objects.find((x) => x.id === sel) : null;
  if (o) return <ObjectPanel api={api} id={o.id} />;
  return <ScenePanel api={api} />;
}

function KeyPanel({ api, track }: { api: StudioApi; track: Track }) {
  const k = api.selectedKey;
  if (!k || k.track !== track) return null;
  const keys = track === "camera" ? api.scene.camera.keys : api.scene.objects.find((o) => o.id === track)?.keys ?? [];
  const key = keys.find((x) => Math.abs(x.t - k.t) < 0.5 / api.scene.fps);
  if (!key) return null;
  return (
    <Section title="Selected keyframe">
      <Row label="At"><span className="font-mono text-[12px] text-text">{key.t.toFixed(2)} s</span></Row>
      <Row label="Leaves">
        <Select value={key.ease} onChange={(v) => api.setKeyEase(v as Ease)} disabled={!api.canEdit}>
          {EASES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Row>
      <p className="text-[11px] leading-relaxed text-text-faint">{EASES.find((e) => e.id === key.ease)?.hint}</p>
      {track === "camera" && api.scene.camera.flow !== "keys" && (
        <p className="text-[11px] leading-relaxed text-text-faint">
          The camera's motion is set to {api.scene.camera.flow === "even" ? "even speed" : "continuous"}, so it flows through this key and its ease is not used. Choose Stop at keys under Motion to use it.
        </p>
      )}
      {track === "camera" && (() => {
        const cam = api.scene.camera;
        const shaped = !!(key as { tan?: unknown }).tan;
        const usable = cam.flow !== "keys" && cam.path === "smooth";
        return (
          <>
            <Row label="Curve">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text">{shaped ? "Shaped by hand" : "Automatic"}</span>
                {shaped && api.canEdit && <Btn onClick={api.resetKeyCurve}>Reset</Btn>}
              </div>
            </Row>
            <p className="text-[11px] leading-relaxed text-text-faint">
              {usable
                ? "In Free view the arrows sit on this key: drag them to move it. Drag the pink handles either side to bend the path through it. Click any dot on the path to pick its key."
                : cam.path !== "smooth"
                  ? "The path is set to Straight, so it has no curve to shape. Choose Curved under Path to bend it."
                  : "Curve handles work with Continuous or Even speed motion. Stop at keys uses its own curve."}
            </p>
          </>
        );
      })()}
    </Section>
  );
}

function TransformSection({ api, track, camera }: { api: StudioApi; track: Track; camera?: boolean }) {
  const p = api.posed(track);
  const dis = !api.canEdit;
  return (
    <Section title="At the playhead" right={<span className="font-mono text-[10.5px] text-text-faint">{api.t.toFixed(2)} s</span>}>
      <Row label="Position"><Vec value={p.p} step={0.05} onChange={(v) => api.writePose(track, { p: v }, `pos${track}`)} disabled={dis} /></Row>
      <Row label={camera ? "Pan/tilt/roll" : "Turn"}>
        <Vec value={p.r} labels={camera ? ["P", "T", "R"] : ["Y", "P", "R"]} step={1} digits={1}
          onChange={(v) => api.writePose(track, { r: v }, `rot${track}`)} disabled={dis} />
      </Row>
    </Section>
  );
}

function camPadSpecs(api: StudioApi, aimed: boolean): PadSpec[] {
  const a = (label: string, action: CamPadAction) => ({ label, act: (t: number) => api.camPad(action, t) });
  return [
    {
      title: "Move",
      up: a("Boom up", "boomUp"),
      down: a("Boom down", "boomDown"),
      left: a("Truck left", "truckLeft"),
      right: a("Truck right", "truckRight"),
      outerUp: a("Push in", "pushIn"),
      outerDown: a("Pull out", "pullOut"),
    },
    {
      title: "Aim",
      up: a(aimed ? "Frame them lower (tilt up)" : "Tilt up", "tiltUp"),
      down: a(aimed ? "Frame them higher (tilt down)" : "Tilt down", "tiltDown"),
      left: a(aimed ? "Frame them right (pan left)" : "Pan left", "panLeft"),
      right: a(aimed ? "Frame them left (pan right)" : "Pan right", "panRight"),
      outerUp: a("Zoom in (longer lens)", "zoomIn"),
      outerDown: a("Zoom out (wider lens)", "zoomOut"),
    },
  ];
}

function CameraPanel({ api }: { api: StudioApi }) {
  const { scene, canEdit } = api;
  const cam = scene.camera;
  const lens = api.posed("camera").lens ?? 35;
  const [target, setTarget] = useState<string>("");
  const remaining = Math.max(1, +(scene.duration - api.t).toFixed(2));
  const [len, setLen] = useState<number | null>(null);
  const plen = Math.min(len ?? remaining, scene.duration);
  const sp = api.speedOf("camera");
  return (
    <div>
      <Section title="Camera">
        <Row label="Body">
          <Select value={cam.body} onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, body: v } }))} disabled={!canEdit}>
            {BODIES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Row>
        <Row label="Lens">
          <Num value={lens} step={1} min={8} max={600} suffix="mm" digits={0} label="mm"
            onChange={(v) => api.writePose("camera", { lens: v }, "lens")} disabled={!canEdit} />
        </Row>
        <div className="flex flex-wrap gap-1">
          {LENSES.map((l) => (
            <button key={l} type="button" disabled={!canEdit} onClick={() => api.writePose("camera", { lens: l })}
              className={`rounded-[5px] border px-1.5 py-0.5 font-mono text-[10.5px] ${Math.round(lens) === l ? "border-accent bg-accent text-accent-fg" : "border-border text-text-muted hover:text-text"}`}>{l}</button>
          ))}
        </div>
        <Row label="Rides with">
          <Select value={cam.parent ?? ""} onChange={(v) => api.setParent("camera", v || null)} disabled={!canEdit}>
            <option value="">Nothing (free in the world)</option>
            {scene.objects.filter((o) => o.kind !== "road" && o.kind !== "sea").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Row>
        {cam.parent && (
          <p className="text-[11px] leading-relaxed text-text-faint">
            The camera's keys are relative to {scene.objects.find((o) => o.id === cam.parent)?.name}: it travels with it, and a key behind it stays behind it.
          </p>
        )}
        <Row label="Path">
          <Seg value={cam.path} onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, path: v } }))} disabled={!canEdit}
            options={[{ id: "smooth", name: "Curved", hint: "A smooth curve through every key" }, { id: "linear", name: "Straight", hint: "Straight lines between keys" }]} />
        </Row>
        <p className="pt-1 text-[11.5px] text-text-muted">Motion</p>
        <Seg value={cam.flow} options={CAMERA_FLOWS} disabled={!canEdit}
          onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, flow: v } }))} />
        <p className="text-[11px] leading-relaxed text-text-faint">{CAMERA_FLOWS.find((f) => f.id === cam.flow)?.hint}.</p>
        {cam.flow !== "keys" && (
          <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-text-muted">
            <input type="checkbox" checked={cam.easeEnds} disabled={!canEdit}
              onChange={(e) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, easeEnds: e.target.checked } }))} />
            Start and finish at rest
          </label>
        )}
        {(sp.peak > 0) && (
          <p className="text-[11px] text-text-muted">
            Travels {sp.travel.toFixed(1)} m, peaks at {sp.peak.toFixed(1)} m/s ({(sp.peak * 3.6).toFixed(0)} km/h){cam.parent ? " relative to what it rides with" : ""}.
          </p>
        )}
      </Section>
      {canEdit && (
        <Section title="Position">
          <ControlPads pads={camPadSpecs(api, !!cam.aim.target)} caption={
            cam.aim.target
              ? <>Pan and tilt frame {scene.objects.find((o) => o.id === cam.aim.target)?.name} off centre while the camera is kept aimed. Keys work too: W A S D, Q E.</>
              : <>Keys work too through the lens: W A S D and Q E.</>
          } />
          <p className="text-[11px] leading-relaxed text-text-faint">
            {cam.keys.length > 1 ? "Each move sets a key at the playhead, the same as dragging in the view." : "Moves the camera. Move the playhead and press I (or turn on Auto key) to make it a move."}
          </p>
        </Section>
      )}
      <Section title="Keep aimed at">
        <Row label="Subject">
          <Select value={cam.aim.target ?? ""} disabled={!canEdit}
            onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, aim: { target: v || null, frame: [0, 0] } } }))}>
            <option value="">Nothing (the keys aim the camera)</option>
            {scene.objects.filter((o) => !["road", "sea", "hill", "mountain", "room"].includes(o.kind)).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </Row>
        {cam.aim.target ? (
          <>
            <p className="text-[11px] leading-relaxed text-text-faint">
              The camera stays locked on {scene.objects.find((o) => o.id === cam.aim.target)?.name} through the whole shot, wherever its path goes. Drag in the camera view, or pan and tilt, to frame them off centre. The framing belongs to the keyframe at the playhead, so each key can sit them differently.
            </p>
            {(() => {
              const af = api.posed("camera").af ?? [0, 0];
              if (Math.abs(af[0]) < 0.05 && Math.abs(af[1]) < 0.05) return null;
              return (
                <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span>At the playhead the camera is turned {Math.abs(af[0]).toFixed(1)}° {af[0] > 0 ? "left" : "right"} and {Math.abs(af[1]).toFixed(1)}° {af[1] > 0 ? "up" : "down"} of them</span>
                  <Btn disabled={!canEdit} onClick={() => api.writePose("camera", { af: [0, 0] })}>Centre</Btn>
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-text-faint">Lock the camera on a subject so it never drifts off them between keys.</p>
        )}
      </Section>
      <KeyPanel api={api} track="camera" />
      <TransformSection api={api} track="camera" camera />
      <Section title="Move presets">
        <Row label="Aim at">
          <Select value={target} onChange={setTarget}>
            <option value="">Where it is looking (5 m out)</option>
            {scene.objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Row>
        <Row label="Over">
          <Num value={plen} onChange={(v) => setLen(v)} step={0.5} min={0.5} max={scene.duration} suffix="s" digits={1} />
        </Row>
        <p className="text-[11px] leading-relaxed text-text-faint">Starts from the camera as it stands at the playhead and replaces any keys inside the move.</p>
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" disabled={!canEdit} title={p.hint}
              onClick={() => api.applyPreset(p.id, target || null, plen)}
              className="rounded-[6px] border border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-text hover:border-accent disabled:opacity-40">
              {p.name}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Handheld">
        <Row label="Amount">
          <Num value={cam.shake.amount * 100} step={5} min={0} max={100} suffix="%" digits={0} disabled={!canEdit}
            onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, shake: { ...s.camera.shake, amount: v / 100 } } }), "shake")} />
        </Row>
        <Row label="Energy">
          <Num value={cam.shake.speed} step={0.1} min={0.1} max={4} suffix="x" digits={1} disabled={!canEdit}
            onChange={(v) => api.updateScene((s) => ({ ...s, camera: { ...s.camera, shake: { ...s.camera.shake, speed: v } } }), "shakes")} />
        </Row>
        <p className="text-[11px] leading-relaxed text-text-faint">A wobble on top of the path. 20% reads as a stabilised rig, 70% as loose handheld.</p>
      </Section>
    </div>
  );
}

function ObjectPanel({ api, id }: { api: StudioApi; id: string }) {
  const { scene, canEdit } = api;
  const o = scene.objects.find((x) => x.id === id)!;
  const k = blockKind(o.kind);
  const vehicle = k.category === "vehicles";
  const walker = o.kind === "person" || o.kind === "child" || o.kind === "dog";
  const [speed, setSpeed] = useState(vehicle ? 40 : 5);
  const sp = api.speedOf(o.id);
  const dis = !canEdit;
  return (
    <div>
      <Section title={k.name} right={canEdit ? (
        <div className="flex gap-1">
          <Btn onClick={() => api.duplicateObject(o.id)} title="Duplicate (Ctrl+D)">Copy</Btn>
          <Btn tone="danger" onClick={() => api.deleteObject(o.id)} title="Delete (Delete)">Delete</Btn>
        </div>
      ) : undefined}>
        <Row label="Name">
          <input value={o.name} disabled={dis} onChange={(e) => api.updateObject(o.id, { name: e.target.value }, `name${o.id}`)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 w-full rounded-[6px] border border-border bg-surface-2 px-2 text-[12px] text-text outline-none" />
        </Row>
        <Row label="Colour"><Swatches value={o.color} colors={SUBJECT_COLORS} onChange={(c) => api.updateObject(o.id, { color: c }, `col${o.id}`)} /></Row>
        <Row label="Size">
          <Vec value={o.size} labels={["W", "H", "D"]} step={0.05} onChange={(v) => api.updateObject(o.id, { size: v.map((x) => Math.max(0.01, x)) as Vec3 }, `size${o.id}`)} disabled={dis} />
        </Row>
        {k.poses && (
          <Row label="Pose">
            <Select value={o.pose ?? k.poses[0]} onChange={(v) => api.updateObject(o.id, { pose: v })} disabled={dis}>
              {k.poses.map((p) => <option key={p} value={p}>{POSES.find((x) => x.id === p)?.name ?? (p === "seated" ? "Sitting" : "Standing")}</option>)}
            </Select>
          </Row>
        )}
        {k.seats && (
          <Row label="Seating">
            <Select value={o.seats ?? k.seats[0].id} onChange={(v) => api.updateObject(o.id, { seats: v })} disabled={dis}>
              {k.seats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Row>
        )}
        <Row label="Rides with">
          <Select value={o.parent ?? ""} onChange={(v) => api.setParent(o.id, v || null)} disabled={dis}>
            <option value="">Nothing</option>
            {scene.objects.filter((x) => x.id !== o.id && x.parent !== o.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Row>
        {(sp.peak > 0) && (
          <p className="text-[11px] text-text-muted">Moves {sp.travel.toFixed(1)} m, peaks at {(sp.peak * 3.6).toFixed(0)} km/h.</p>
        )}
      </Section>
      <KeyPanel api={api} track={o.id} />
      <TransformSection api={api} track={o.id} />
      {(vehicle || walker) && canEdit && (
        <Section title={vehicle ? "Drive" : "Walk"}>
          <Row label="Speed">
            <Num value={speed} onChange={setSpeed} step={vehicle ? 5 : 0.5} min={0.5} max={vehicle ? 250 : 40} suffix="km/h" digits={vehicle ? 0 : 1} />
          </Row>
          <Btn className="w-full" onClick={() => api.drive(o.id, speed / 3.6, Math.max(0.5, scene.duration - api.t))}>
            {vehicle ? "Drive" : "Walk"} straight ahead from here to the end
          </Btn>
          <p className="text-[11px] leading-relaxed text-text-faint">
            Keys it where it stands now and where it gets to by the end, at a steady speed in the way it faces.
          </p>
        </Section>
      )}
    </div>
  );
}

const GROUNDS: { id: Environment["ground"]; name: string }[] = [
  { id: "grass", name: "Grass" }, { id: "asphalt", name: "Asphalt" }, { id: "sand", name: "Sand" },
  { id: "dirt", name: "Dirt" }, { id: "snow", name: "Snow" }, { id: "studio", name: "Studio floor" },
  { id: "water", name: "Water" }, { id: "none", name: "None" },
];

function ScenePanel({ api }: { api: StudioApi }) {
  const { scene, canEdit } = api;
  const env = scene.environment;
  const setEnv = (patch: Partial<Environment>, c?: string) => api.updateScene((s) => ({ ...s, environment: { ...s.environment, ...patch } }), c);
  const dis = !canEdit;
  return (
    <div>
      <Section title="Scene">
        <Row label="Name">
          <input value={scene.name} disabled={dis} onChange={(e) => api.updateScene((s) => ({ ...s, name: e.target.value }), "name")}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 w-full rounded-[6px] border border-border bg-surface-2 px-2 text-[12px] text-text outline-none" />
        </Row>
        <Row label="Frame">
          <Select value={scene.aspect} onChange={(v) => api.updateScene((s) => ({ ...s, aspect: v }))} disabled={dis}>
            {BLOCK_ASPECTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Select>
        </Row>
        <Row label="Look">
          <Seg value={scene.look} options={LOOKS} onChange={(v) => api.updateScene((s) => ({ ...s, look: v }))} disabled={dis} />
        </Row>
        <p className="text-[11px] leading-relaxed text-text-faint">{LOOKS.find((l) => l.id === scene.look)?.hint}</p>
      </Section>
      <Section title="Environment">
        <Row label="Sky"><Swatches value={env.sky} colors={["#b9cde0", "#d9c8ae", "#c3cbd4", "#e8b48c", "#2b3445", "#9fa4ab", "#1d1f23"]} onChange={(c) => setEnv({ sky: c }, "sky")} /></Row>
        <Row label="Ground">
          <Select value={env.ground} onChange={(v) => setEnv({ ground: v as Environment["ground"] })} disabled={dis}>
            {GROUNDS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Row>
        <Row label="Haze"><Num value={env.haze * 100} step={5} min={0} max={100} suffix="%" digits={0} onChange={(v) => setEnv({ haze: v / 100 }, "haze")} disabled={dis} /></Row>
        <Row label="Sun"><Vec value={[env.sunAz, env.sunEl, 0]} labels={["Az", "El", "·"]} step={2} digits={0}
          onChange={(v) => setEnv({ sunAz: v[0], sunEl: Math.min(90, Math.max(2, v[1])) }, "sun")} disabled={dis} /></Row>
      </Section>
      <Section title="Getting around">
        <ul className="space-y-1 text-[11.5px] leading-relaxed text-text-muted">
          <li><b className="text-text">Camera view</b>: drag to look, right-drag to slide, scroll to move in, Alt+scroll to zoom the lens. W A S D and Q E fly.</li>
          <li><b className="text-text">Free view</b>: drag to orbit, right-drag to pan. Click anything to select it, then drag its handles. G moves, R turns.</li>
          <li><b className="text-text">I</b> sets a keyframe, <b className="text-text">Space</b> plays, <b className="text-text">Tab</b> swaps views, <b className="text-text">Ctrl+Z</b> undoes.</li>
        </ul>
      </Section>
    </div>
  );
}
