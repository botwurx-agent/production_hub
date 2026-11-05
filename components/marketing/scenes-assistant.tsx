"use client";

import type { ReactNode } from "react";
import { ActionLabel, Chip, Cursor, Window, arrive, dragAt, ramp, typed } from "./scene-kit";

/**
 * The two connector chapters: a connected Claude or ChatGPT laying out a
 * scene builder setup, and a shot blocking scene, from one message.
 *
 * Left is the chat (the producer's words, the tool call, the answer with its
 * link); right is the plan of what lands in Studio Flows, drawn piece by
 * piece. The plan is a TOP-DOWN diagram drawn in tokens, deliberately not an
 * imitation of the 3D viewport: what the chapter claims is that the pieces
 * land in the right places, and the plan is where that is legible at this
 * size. The assistant's name is said in text only; no brand marks.
 */

const CHAT_W = 248;

function ChatPanel({
  t,
  ask,
  askAt,
  tool,
  toolAt,
  doneAt,
  answer,
  linkLabel,
}: {
  t: number;
  ask: string;
  askAt: number;
  tool: string;
  toolAt: number;
  doneAt: number;
  answer: string;
  linkLabel: string;
}) {
  const sent = t >= toolAt;
  return (
    <div className="absolute border-r border-border" style={{ left: 0, top: 52, width: CHAT_W, height: 388, background: "var(--surface-2)" }}>
      <div className="absolute inset-x-3 top-3 space-y-2.5">
        {t >= askAt ? (
          <div className="ml-6 rounded-[12px] rounded-br-[4px] px-2.5 py-2 text-[11px] leading-[1.45]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {sent ? ask : typed(ask, t, askAt, 18)}
          </div>
        ) : null}
        {sent ? (
          <div className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[10px] font-bold text-text-muted" style={{ border: "1px dashed var(--border)", ...arrive(t, toolAt, 6) }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: t >= doneAt ? "var(--h-green)" : "var(--h-amber)" }} />
            <span className="font-mono">{tool}</span>
            <span className="ml-auto">{t >= doneAt ? "done" : "working"}</span>
          </div>
        ) : null}
        {t >= doneAt ? (
          <div className="mr-4 space-y-2 text-[11px] leading-[1.45]" style={arrive(t, doneAt, 6)}>
            <p>{typed(answer, t, doneAt + 150, 12)}</p>
            <span
              className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[10.5px] font-extrabold"
              style={{ background: "var(--accent)", color: "white", opacity: ramp(t, doneAt + 150 + answer.length * 12, 250) }}
            >
              {linkLabel} →
            </span>
          </div>
        ) : null}
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-[10px] border border-border bg-surface px-2.5 py-2 text-[10.5px] text-text-faint">
        {t < askAt ? "Ask anything…" : "Reply…"}
      </div>
    </div>
  );
}

/** The plan side: a titled panel with a floor-plan grid. */
function Plan({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="absolute overflow-hidden rounded-[14px] border border-border" style={{ left: CHAT_W + 14, top: 66, width: 640 - CHAT_W - 28, height: 360 }}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[12px] font-extrabold">{title}</span>
        <span className="text-[10px] text-text-faint">{sub}</span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: 33,
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "-1px -1px",
          opacity: 0.55,
        }}
      />
      <div className="absolute inset-x-0 bottom-0" style={{ top: 33 }}>
        {children}
      </div>
    </div>
  );
}

/** Pops a piece onto the plan at time `at`. */
const pop = (t: number, at: number) => (t >= at ? arrive(t, at, 4) : { opacity: 0 });

/* --------------------------------------------------------- SCENE BUILDER */

export const AS_SCENE_MS = 15000;

const S_ASK = 500;
const S_TOOL = 3300;
const S_PIECES = [3700, 4200, 4700, 5200, 5800, 6400, 7000, 7600, 8200];
const S_DONE = 8900;
const S_OPEN = 12300;

const SETUP_ASK = "Kitchen pour for Bright Water: Maya behind the island, a 600d through half grid as key, SkyPanel fill, a wide on a 32 and an 85 pushing in on the glass.";

export function AssistantSceneScene({ t }: { t: number }) {
  const [walls, island, maya, glass, key, fill, back, wide, pour] = S_PIECES;
  const push = dragAt(t, pour + 900, 1400, { x: 182, y: 268 }, { x: 182, y: 232 });
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Your Claude or ChatGPT chat" sub="Studio Flows connected">
        <ChatPanel
          t={t}
          ask={SETUP_ASK}
          askAt={S_ASK}
          tool="create_scene_setup"
          toolAt={S_TOOL}
          doneAt={S_DONE}
          answer="Kitchen pour is on the job: 2 cameras, 3 lights, all kept out of shot. Check it in Studio Flows."
          linkLabel="Open the setup"
        />
        <Plan title="Kitchen pour" sub="Scene builder · plan">
          {/* Room: back wall and two sides, open to camera. */}
          <div className="absolute rounded-[2px]" style={{ left: 30, top: 18, width: 290, height: 230, borderTop: "4px solid var(--text-muted)", borderLeft: "4px solid var(--text-muted)", borderRight: "4px solid var(--text-muted)", ...pop(t, walls) }} />
          <span className="absolute text-[9px] font-bold text-text-faint" style={{ left: 38, top: 24, ...pop(t, walls) }}>
            Kitchen · 16 x 13 ft
          </span>
          {/* Island with the glass on it. */}
          <div className="absolute rounded-[4px] border border-border" style={{ left: 120, top: 112, width: 120, height: 40, background: "var(--surface-2)", ...pop(t, island) }}>
            <span className="absolute left-1.5 top-1 text-[8.5px] font-bold text-text-faint">Island</span>
          </div>
          <div className="absolute h-[11px] w-[11px] rounded-full border-2" style={{ left: 178, top: 126, borderColor: "var(--h-blue)", ...pop(t, glass) }} />
          {/* Maya, behind the island. */}
          <div className="absolute flex flex-col items-center" style={{ left: 166, top: 70, ...pop(t, maya) }}>
            <span className="h-[18px] w-[18px] rounded-full" style={{ background: "var(--h-pink)" }} />
            <span className="mt-0.5 text-[9px] font-extrabold">Maya</span>
          </div>
          {/* Lights by role. */}
          <LightMark t={t} at={key} x={270} y={150} label="Key · 600d" sub="Half grid 8x8" hue="amber" frame below />
          <LightMark t={t} at={fill} x={56} y={150} label="Fill · SkyPanel" hue="blue" />
          <LightMark t={t} at={back} x={110} y={32} label="Back" hue="purple" />
          {/* Cameras. */}
          <CamMark t={t} at={wide} x={176} y={292} label="1A Wide · 32mm" spread={46} />
          {t >= pour ? (
            <>
              <CamMark t={t} at={pour} x={push.x} y={push.y} label="1B Pour · 85mm" spread={16} />
              <div className="absolute border-l-2 border-dashed" style={{ left: 189, top: 238, height: 38, borderColor: "var(--h-green)", opacity: ramp(t, pour + 500, 300) }} />
              <span className="absolute text-[9px] font-extrabold" style={{ left: 198, top: 250, color: "var(--h-green)", opacity: ramp(t, pour + 500, 300) }}>
                Push · Fisher dolly
              </span>
            </>
          ) : null}
        </Plan>
        {t >= S_OPEN ? (
          <div className="absolute z-20 rounded-[10px] px-3 py-2 text-[11.5px] font-bold text-white" style={{ left: 300, top: 392, background: "var(--text)", ...arrive(t, S_OPEN, 8) }}>
            Opens in Studio Flows, ready to check through each camera
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={S_ASK + 300} x={20} y={130} text="Describe the setup in words" before={300} after={2200} />
      <ActionLabel t={t} at={key} x={350} y={250} text="Lights placed by role, out of frame" tone="amber" before={100} after={2200} />
      <ActionLabel t={t} at={pour + 900} x={300} y={330} text="A support that can make the move" tone="green" before={100} after={1800} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 300, x: 140, y: 400 },
          { t: 600, x: 140, y: 408, click: true },
          { t: S_DONE + 2400, x: 120, y: 210 },
          { t: S_OPEN, x: 70, y: 245, click: true },
          { t: S_OPEN + 1800, x: 420, y: 300 },
        ]}
      />
    </div>
  );
}

function LightMark({ t, at, x, y, label, sub, hue, frame, below }: { t: number; at: number; x: number; y: number; label: string; sub?: string; hue: string; frame?: boolean; below?: boolean }) {
  return (
    <div className="absolute" style={{ left: x, top: y, ...pop(t, at) }}>
      <span className="block h-[14px] w-[14px] rotate-45 rounded-[3px]" style={{ background: `var(--h-${hue})` }} />
      {frame ? <span className="absolute h-[30px] w-[3px] rounded-full" style={{ left: -12, top: -8, background: `var(--h-${hue})`, opacity: 0.55 }} /> : null}
      <span className="absolute whitespace-nowrap text-[9px] font-extrabold" style={below ? { right: -20, top: 20 } : { left: x > 200 ? undefined : 18, right: x > 200 ? 18 : undefined, top: -2 }}>
        {label}
      </span>
      {sub ? (
        <span className="absolute whitespace-nowrap text-[8.5px] text-text-faint" style={below ? { right: -20, top: 32 } : { right: 18, top: 10 }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function CamMark({ t, at, x, y, label, spread }: { t: number; at: number; x: number; y: number; label: string; spread: number }) {
  return (
    <div className="absolute" style={{ left: x, top: y, ...pop(t, at) }}>
      <svg className="absolute" width={spread * 2 + 4} height="70" style={{ left: 7 - spread - 2, top: -66 }} aria-hidden="true">
        <path d={`M ${spread + 2} 68 L 2 2 L ${spread * 2 + 2} 2 Z`} fill="var(--accent)" opacity="0.12" stroke="var(--accent)" strokeOpacity="0.5" />
      </svg>
      <span className="relative block h-[14px] w-[16px] rounded-[3px]" style={{ background: "var(--accent)" }} />
      <span className="absolute whitespace-nowrap text-[9px] font-extrabold" style={{ left: 22, top: 1 }}>
        {label}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------- SHOT BLOCKING */

export const AS_BLOCK_MS = 15000;

const B_ASK = 500;
const B_TOOL = 3200;
const B_PIECES = [3600, 4100, 4600, 5100, 5700];
const B_DONE = 6600;
const B_PLAY = 9600;
const B_PLAY_MS = 3600;

const BLOCK_ASK = "Coast road, 10 seconds: an SUV drives toward camera, a dog in the back seat. Camera chases from behind, comes alongside the dog's window, ends ahead.";

/** Where the SUV is along the road, 0..1, during playback. */
const carAt = (p: number) => ({ x: 70 + p * 230, y: 230 - p * 150 });
/** The camera's path: behind, alongside, ahead. */
const CAM_KEYS = [
  { x: 40, y: 278 },
  { x: 205, y: 182 },
  { x: 330, y: 50 },
];

export function AssistantBlockingScene({ t }: { t: number }) {
  const [road, suv, dog, camPath, timeline] = B_PIECES;
  const p = ramp(t, B_PLAY, B_PLAY_MS);
  const car = carAt(p);
  const seg = p < 0.5 ? 0 : 1;
  const sp = p < 0.5 ? p * 2 : (p - 0.5) * 2;
  const cam = {
    x: CAM_KEYS[seg].x + (CAM_KEYS[seg + 1].x - CAM_KEYS[seg].x) * sp,
    y: CAM_KEYS[seg].y + (CAM_KEYS[seg + 1].y - CAM_KEYS[seg].y) * sp,
  };
  const angle = (Math.atan2(car.y - cam.y, car.x - cam.x) * 180) / Math.PI;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Your Claude or ChatGPT chat" sub="Studio Flows connected">
        <ChatPanel
          t={t}
          ask={BLOCK_ASK}
          askAt={B_ASK}
          tool="create_blocking_scene"
          toolAt={B_TOOL}
          doneAt={B_DONE}
          answer="Coast road chase is on the job: the SUV, the dog on the rear bench, and a camera kept on the dog. Record the clip in Studio Flows."
          linkLabel="Open the scene"
        />
        <Plan title="Coast road chase" sub="Shot blocking · plan">
          {/* Road, diagonal toward camera. */}
          <div className="absolute" style={{ left: 30, top: 233, ...pop(t, road) }}>
            <div className="absolute rounded-[6px]" style={{ left: 0, top: 0, width: 380, height: 46, background: "var(--surface-2)", border: "1px solid var(--border)", transform: "rotate(-33deg)", transformOrigin: "0 23px" }}>
              <div className="absolute inset-x-3 top-1/2 border-t-2 border-dashed" style={{ borderColor: "var(--text-faint)" }} />
            </div>
          </div>
          <span className="absolute text-[9px] font-bold text-text-faint" style={{ left: 236, top: 196, ...pop(t, road) }}>
            Coast road · hills · sea
          </span>
          {/* The SUV with the dog inside. */}
          <div className="absolute" style={{ left: car.x - 17, top: car.y - 9, ...pop(t, suv) }}>
            <div className="relative" style={{ transform: "rotate(-33deg)" }}>
              <span className="block h-[18px] w-[34px] rounded-[5px]" style={{ background: "var(--h-blue)" }} />
              <span className="absolute h-[8px] w-[8px] rounded-full" style={{ left: 7, top: 5, background: "var(--h-amber)", ...pop(t, dog) }} />
            </div>
          </div>
          <span className="absolute whitespace-nowrap text-[9px] font-extrabold" style={{ left: car.x + 20, top: car.y + 2, ...pop(t, suv) }}>
            SUV{t >= dog ? " · dog, rear bench" : ""}
          </span>
          {/* Camera path with its keys. */}
          <svg className="absolute inset-0" width="100%" height="100%" aria-hidden="true" style={{ opacity: ramp(t, camPath, 400) }}>
            <path d={`M ${CAM_KEYS[0].x} ${CAM_KEYS[0].y} Q 110 255 ${CAM_KEYS[1].x} ${CAM_KEYS[1].y} T ${CAM_KEYS[2].x} ${CAM_KEYS[2].y}`} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="5 4" />
            {CAM_KEYS.map((k, i) => (
              <rect key={i} x={k.x - 4} y={k.y - 4} width="8" height="8" transform={`rotate(45 ${k.x} ${k.y})`} fill="var(--accent)" />
            ))}
          </svg>
          {t >= camPath ? (
            <div className="absolute" style={{ left: cam.x - 8, top: cam.y - 7 }}>
              <span className="block h-[14px] w-[16px] rounded-[3px]" style={{ background: "var(--accent)", transform: `rotate(${angle}deg)` }} />
            </div>
          ) : null}
          {t >= camPath ? (
            <span className="absolute text-[9px] font-extrabold" style={{ left: 14, top: 10, color: "var(--accent)", ...pop(t, camPath) }}>
              Camera · kept aimed at the dog
            </span>
          ) : null}
          {/* Timeline. */}
          <div className="absolute inset-x-3 bottom-2 rounded-[8px] border border-border bg-surface px-2 py-1.5" style={pop(t, timeline)}>
            <div className="flex items-center justify-between text-[9px] font-bold text-text-faint">
              <span>0s</span>
              <span>Camera keys · SUV move</span>
              <span>10s</span>
            </div>
            <div className="relative mt-1 h-[6px] rounded-full bg-surface-2">
              {[0, 0.5, 1].map((k) => (
                <span key={k} className="absolute top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px]" style={{ left: `${k * 100}%`, background: "var(--accent)" }} />
              ))}
              <span className="absolute top-[-3px] h-[12px] w-[2px] rounded-full" style={{ left: `${p * 100}%`, background: "var(--text)" }} />
            </div>
          </div>
        </Plan>
        {t >= B_PLAY + B_PLAY_MS + 300 ? (
          <div className="absolute z-20 flex items-center gap-2" style={{ left: 330, top: 392, ...arrive(t, B_PLAY + B_PLAY_MS + 300, 8) }}>
            <Chip tone="green" t={t} since={B_PLAY + B_PLAY_MS + 300}>
              Ready to record the blocking clip
            </Chip>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={B_ASK + 300} x={20} y={130} text="Describe the shot in words" before={300} after={2200} />
      <ActionLabel t={t} at={suv} x={360} y={130} text="Passengers ride with the car" tone="blue" before={100} after={2000} />
      <ActionLabel t={t} at={B_PLAY + 400} x={300} y={300} text="Play it back in Studio Flows" tone="green" before={300} after={2400} />
      <Cursor
        t={t}
        travel={700}
        path={[
          { t: 300, x: 140, y: 400 },
          { t: 600, x: 140, y: 408, click: true },
          { t: B_DONE + 2000, x: 120, y: 230 },
          { t: B_PLAY - 300, x: 70, y: 268, click: true },
          { t: B_PLAY + 1600, x: 460, y: 330 },
        ]}
      />
    </div>
  );
}
