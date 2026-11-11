"use client";

import type { ReactNode } from "react";
import { clamp01, lerp, ramp, spring } from "./scene-kit";
import {
  ACCENT,
  BODY,
  Caption,
  DISPLAY,
  FULL,
  GLOW,
  Ground,
  H,
  INK,
  Lens,
  Mark,
  Pointer,
  Rise,
  Screen,
  Shot,
  Spot,
  Tag,
  W,
  WIDE,
  camAt,
  easeIn4,
  easeOut3,
  easeOut4,
  frameAt,
  frameSrc,
  resolve,
  sinceClick,
  stillSrc,
  type CamKey,
  type Takes,
} from "./tour-kit";

/*
 * THE PRODUCT TOUR, 16:9, cut from real footage of the demo studio.
 *
 * Made to sit under (or beside) somebody talking, so it carries no voice of
 * its own: every beat is one move on screen and one short line at the foot of
 * the frame, big enough to read at half a phone screen.
 *
 * The footage is stop motion (scripts/film/capture-tour.mjs), so the edit
 * decides the pace: a `map` per shot says which captured frame shows at which
 * moment, and a camera per shot says where to look. Positions are page pixels
 * of the 1280x720 app, read off the captured frames.
 */

export const TOUR_MS = 75500;

/** Where the look-at point sits on screen while a caption holds the foot. */
const CY = 440;
/** Each shot starts this long before the one above it has finished leaving. */
const LAP = 260;

type MapPts = [number, number][];

function Footage({ takes, name, map, cam, t, pointer = true, dim = 0, children }: { takes: Takes; name: string; map: MapPts; cam: CamKey[]; t: number; pointer?: boolean; dim?: number; children?: ReactNode }) {
  const f = frameAt(takes[name], map, t);
  const c = camAt(cam, t);
  return (
    <Screen src={frameSrc(name, f.i)} cam={c} cy={CY} dim={dim}>
      {children}
      {pointer && <Pointer x={f.x} y={f.y} down={!!f.d} since={sinceClick(takes[name], f.n)} s={resolve(c, CY).s} />}
    </Screen>
  );
}

/* -------------------------------------------------------------------- HOOK */

const TILES: { x: number; y: number; r: number; label: string; hue: string; glyph: string }[] = [
  { x: 150, y: 120, r: -7, label: "Budget_v7_FINAL.xlsx", hue: "green", glyph: "X" },
  { x: 1310, y: 96, r: 5, label: "callsheet_day1 (3).pdf", hue: "red", glyph: "P" },
  { x: 700, y: 70, r: -2, label: "Inbox (47)", hue: "blue", glyph: "@" },
  { x: 60, y: 420, r: 4, label: "#bright-water", hue: "purple", glyph: "#" },
  { x: 1420, y: 400, r: -5, label: "storyboard_notes_v2.pdf", hue: "orange", glyph: "P" },
  { x: 210, y: 760, r: 6, label: "shotlist copy 2.docx", hue: "blue", glyph: "W" },
  { x: 1250, y: 770, r: -4, label: "Transfer link expired", hue: "amber", glyph: "!" },
  { x: 700, y: 880, r: 3, label: "schedule_REV4.xlsx", hue: "green", glyph: "X" },
  { x: 1500, y: 620, r: 7, label: "Client feedback???", hue: "pink", glyph: "?" },
  { x: 40, y: 610, r: -3, label: "Invoice_1042.pdf", hue: "red", glyph: "P" },
  { x: 1080, y: 250, r: -8, label: "Drive / Final / Final 2", hue: "cyan", glyph: "D" },
  { x: 440, y: 250, r: 8, label: "Review link (old)", hue: "purple", glyph: "L" },
];

function Hook({ t }: { t: number }) {
  const pull = easeIn4(ramp(t, 2750, 620));
  const flash = ramp(t, 3300, 120) * (1 - ramp(t, 3420, 500));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {TILES.map((k, i) => {
        const p = ramp(t, 200 + i * 105, 420);
        if (p <= 0) return null;
        const e = spring(p);
        const drift = Math.sin(t / 700 + i * 1.7) * 7;
        const x = lerp(k.x, W / 2 - 190, pull);
        const y = lerp(k.y + drift, H / 2 - 44, pull);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `rotate(${k.r + pull * (i % 2 ? 80 : -80)}deg) scale(${e * (1 - pull * 0.92)})`,
              opacity: clamp01(p * 3) * (1 - clamp01((pull - 0.8) / 0.2)),
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "20px 28px 20px 20px",
              borderRadius: 22,
              background: "rgba(255,255,255,.08)",
              border: "1.5px solid rgba(255,255,255,.16)",
              boxShadow: "0 24px 60px rgba(0,0,0,.4)",
              backdropFilter: "blur(6px)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 52, height: 52, borderRadius: 14, background: `var(--h-${k.hue})`, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: "#fff" }}>{k.glyph}</span>
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,.92)" }}>{k.label}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 388, textAlign: "center", opacity: 1 - clamp01(ramp(t, 2650, 300)), transform: `scale(${1 - pull * 0.3})` }}>
        <div style={{ display: "inline-block", padding: "30px 60px", borderRadius: 36, background: "rgba(7,6,26,.82)", boxShadow: "0 0 120px 60px rgba(7,6,26,.82)" }}>
          <Rise text="Your production lives" t={t} at={500} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }} />
          <Rise text="in 12 different places." t={t} at={900} hi={[1, 2, 3]} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 104, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#fff" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: W / 2 - 700, top: H / 2 - 700, width: 1400, height: 1400, borderRadius: 9999, background: `radial-gradient(circle, ${GLOW} 0%, transparent 60%)`, opacity: flash * 0.9, transform: `scale(${0.3 + ramp(t, 3300, 600) * 1.2})` }} />
    </div>
  );
}

function Title({ t, at }: { t: number; at: number }) {
  const p = ramp(t, at, 700);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ width: 168, height: 168, borderRadius: 46, background: ACCENT, display: "grid", placeItems: "center", transform: `scale(${spring(ramp(t, at, 520))})`, boxShadow: "0 30px 90px color-mix(in oklch, var(--h-indigo) 60%, transparent)" }}>
          <Mark size={100} p={ramp(t, at + 180, 700)} />
        </div>
        <Rise text="Studio Flows" t={t} at={at + 260} stagger={110} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 168, letterSpacing: "-0.05em", lineHeight: 1, color: "#fff" }} />
      </div>
      <div style={{ opacity: p }}>
        <Rise text="The whole job. One place." t={t} at={at + 800} hi={[3, 4]} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, letterSpacing: "-0.02em", color: "rgba(255,255,255,.86)" }} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- CHROME */

const CHAPTERS: [number, string][] = [
  [6000, "Projects"],
  [16000, "Plan"],
  [24400, "Shoot"],
  [35600, "Review"],
  [49400, "Money"],
  [55200, "Previz + AI"],
  [63200, "And more"],
  [69800, ""],
];

function Chrome({ t }: { t: number }) {
  const on = ramp(t, 6200, 500) * (1 - ramp(t, 69700, 300));
  if (on <= 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, opacity: on, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150, background: "linear-gradient(to bottom, rgba(7,6,26,.6), rgba(7,6,26,0))" }} />
      <div style={{ position: "absolute", left: 44, top: 34, display: "flex", alignItems: "center", gap: 14, padding: "10px 22px 10px 10px", borderRadius: 999, background: "rgba(10,9,32,.88)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.14), 0 10px 30px rgba(0,0,0,.35)" }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: ACCENT, display: "grid", placeItems: "center" }}>
          <Mark size={26} />
        </span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 27, letterSpacing: "-0.02em", color: "#fff" }}>Studio Flows</span>
      </div>
      <div style={{ position: "absolute", right: 44, top: 46, display: "flex", gap: 8 }}>
        {CHAPTERS.slice(0, -1).map(([a], i) => {
          const b = CHAPTERS[i + 1][0];
          const p = clamp01((t - a) / (b - a));
          const live = t >= a && t < b;
          return (
            <span key={i} style={{ width: live ? 120 : 44, height: 8, borderRadius: 9, background: "rgba(255,255,255,.22)", overflow: "hidden", transition: "none" }}>
              <span style={{ display: "block", width: `${p * 100}%`, height: "100%", background: live ? GLOW : "rgba(255,255,255,.75)" }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** One still under a slow push, for the screens the film only glances at. */
function Still({ name, t, a, dur, from, to, children }: { name: string; t: number; a: number; dur: number; from: [number, number, number]; to: [number, number, number]; children?: ReactNode }) {
  const p = clamp01((t - a) / dur);
  const cam = { x: lerp(from[0], to[0], p), y: lerp(from[1], to[1], p), z: lerp(from[2], to[2], p) };
  return (
    <Screen src={stillSrc(name)} cam={cam} cy={CY}>
      {children}
    </Screen>
  );
}

const MONTAGE: [string, string, string, number[]][] = [
  ["crm", "CRM and pipeline", "Win the job.", [0]],
  ["tasks", "Task board", "Run the tasks.", [0]],
  ["contacts", "Crew and contacts", "Book the crew.", [0]],
  ["comms", "Communication", "Keep every thread.", [0]],
  ["delivery", "Deliverables", "Ship the files.", [0]],
  ["reports", "Studio reports", "See what it made.", [3]],
];

/* -------------------------------------------------------------------- FILM */

export function TourFilm({ t, takes }: { t: number; takes: Takes }) {
  const mood = camAt(
    [
      { t: 16000, ...FULL },
      { t: 17300, x: 700, y: 560, z: 1.32 },
      { t: 20200, x: 720, y: 540, z: 1.42 },
    ],
    t,
  );
  const sheetCam: CamKey[] = [
    { t: 30600, ...FULL },
    { t: 31800, x: 980, y: 280, z: 1.45 },
    { t: 32000, x: 980, y: 280, z: 1.45 },
    { t: 32800, x: 640, y: 350, z: 1.1 },
    { t: 33400, x: 640, y: 350, z: 1.1 },
    { t: 35800, x: 640, y: 290, z: 1.3 },
  ];
  const sheetF = frameAt(takes.sheet, [[30600, 22], [31900, 53], [32500, 62], [33300, 84], [34900, 125]], t);
  const budgetCam: CamKey[] = [
    { t: 49400, ...FULL },
    { t: 50500, x: 560, y: 350, z: 1.3 },
    { t: 53000, x: 560, y: 350, z: 1.3 },
    { t: 55600, x: 660, y: 420, z: 1.12 },
  ];
  const budgetF = frameAt(takes.budget, [[49400, 0], [53000, 40], [55400, 119]], t);
  const sceneCam: CamKey[] = [
    { t: 55200, x: 640, y: 420, z: 1.08 },
    { t: 56400, x: 600, y: 430, z: 1.3 },
    { t: 57200, x: 640, y: 430, z: 1.12 },
    { t: 60500, x: 640, y: 440, z: 1.34 },
  ];

  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", background: INK, fontFamily: BODY }}>
      <Ground t={t} />

      {/* 0. THE PROBLEM, THEN THE NAME */}
      <Shot t={t} a={0} b={3500} enter="none" exit="none" z={30}>
        <Hook t={t} />
      </Shot>
      <Shot t={t} a={3300} b={6000 + LAP} enter="none" z={29}>
        <Title t={t} at={3320} />
      </Shot>

      {/* 1. PROJECTS */}
      <Shot t={t} a={6000} b={9700 + LAP} z={28}>
        <Footage takes={takes} name="open" t={t} map={[[6000, 0], [7600, 24], [9300, 47], [9700, 49]]} cam={[{ t: 6000, ...WIDE }, { t: 7300, ...FULL }, { t: 8000, ...FULL }, { t: 9500, x: 760, y: 330, z: 1.5 }]} />
      </Shot>

      {/* 2. THE PROJECT HUB */}
      <Shot t={t} a={9700} b={16000 + LAP} z={27}>
        <Footage
          takes={takes}
          name="open"
          t={t}
          pointer={false}
          map={[[9700, 52], [12300, 88], [15200, 197]]}
          cam={[{ t: 9700, ...FULL }, { t: 10400, ...FULL }, { t: 11300, x: 640, y: 300, z: 1.42 }, { t: 12300, x: 640, y: 300, z: 1.42 }, { t: 13300, x: 700, y: 380, z: 1.0 }, { t: 16200, x: 760, y: 380, z: 1.16 }]}
        >
          <Spot x={296} y={262} w={372} h={44} r={22} p={ramp(t, 10700, 400) * (1 - ramp(t, 12000, 300))} s={2} />
        </Footage>
        <Tag cam={camAt([{ t: 11300, x: 640, y: 300, z: 1.42 }], t)} cy={CY} px={480} py={306} text="Where the job stands" t={t < 12100 ? t : 0} at={11000} dy={74} tone="accent" />
      </Shot>

      {/* 3. MOODBOARD */}
      <Shot t={t} a={16000} b={20800 + LAP} z={26}>
        <Footage takes={takes} name="mood" t={t} map={[[16000, 18], [17500, 45], [19500, 83], [20800, 107]]} cam={[{ t: 16000, ...mood }, { t: 30000, ...mood }]} />
      </Shot>

      {/* 4. STORYBOARD, THEN THE SHOT LIST */}
      <Shot t={t} a={20800} b={22900 + LAP} exit="whip" z={25}>
        <Footage takes={takes} name="story" t={t} pointer={false} map={[[20800, 10], [22900, 70]]} cam={[{ t: 20800, x: 760, y: 420, z: 1.1 }, { t: 23200, x: 780, y: 450, z: 1.28 }]} />
      </Shot>
      <Shot t={t} a={22900} b={24400 + LAP} enter="whip" z={24}>
        <Still name="shots" t={t} a={22900} dur={1800} from={[820, 440, 1.12]} to={[860, 460, 1.26]} />
      </Shot>

      {/* 5. THE SCHEDULE RE-FLOWS */}
      <Shot t={t} a={24400} b={30600 + LAP} z={23}>
        <Footage
          takes={takes}
          name="sched"
          t={t}
          map={[[24400, 12], [26000, 46], [28000, 80], [30600, 103]]}
          cam={[{ t: 24400, ...FULL }, { t: 25100, ...FULL }, { t: 26000, x: 900, y: 500, z: 1.55 }, { t: 27900, x: 900, y: 500, z: 1.55 }, { t: 28900, x: 640, y: 560, z: 1.18 }, { t: 30800, x: 640, y: 580, z: 1.26 }]}
        >
          <Spot x={100} y={696} w={1150} h={30} r={8} p={ramp(t, 28900, 400)} s={1.8} />
        </Footage>
        <Tag cam={camAt([{ t: 28900, x: 640, y: 560, z: 1.18 }, { t: 30800, x: 640, y: 580, z: 1.26 }], t)} cy={CY} px={640} py={710} text="Runs 30 min into lunch" t={t} at={29100} dy={-70} dx={250} tone="red" />
      </Shot>

      {/* 6. CALL SHEET: WHO HAS CONFIRMED */}
      <Shot t={t} a={30600} b={35600 + LAP} z={22}>
        <Screen src={frameSrc("sheet", sheetF.i)} cam={camAt(sheetCam, t)} cy={CY}>
          <Pointer x={sheetF.x} y={sheetF.y} down={!!sheetF.d} since={sinceClick(takes.sheet, sheetF.n)} s={resolve(camAt(sheetCam, t), CY).s} />
        </Screen>
        <Lens src={frameSrc("sheet", sheetF.i)} cam={camAt(sheetCam, t)} cy={CY} px={400} py={222} d={470} m={1.7} p={ramp(t, 34000, 450) * (1 - ramp(t, 35500, 200))} />
      </Shot>

      {/* 7. PINNED FEEDBACK */}
      <Shot t={t} a={35600} b={40000 + LAP} z={21}>
        <Footage
          takes={takes}
          name="pins"
          t={t}
          map={[[35600, 30], [36300, 44], [37600, 80], [38300, 97], [40000, 103]]}
          cam={[{ t: 35600, ...FULL }, { t: 36500, ...FULL }, { t: 37600, x: 600, y: 430, z: 1.42 }, { t: 40200, x: 640, y: 440, z: 1.5 }]}
        />
      </Shot>

      {/* 8. THE CUT, PLAYING */}
      <Shot t={t} a={40000} b={45200 + LAP} z={20}>
        <Footage takes={takes} name="cut" t={t} pointer={false} map={[[40000, 0], [40300, 0], [45100, 143]]} cam={[{ t: 40000, x: 640, y: 400, z: 1.1 }, { t: 41200, x: 590, y: 440, z: 1.38 }, { t: 45400, x: 600, y: 450, z: 1.48 }]} />
        {(() => {
          const c = camAt([{ t: 40000, x: 640, y: 400, z: 1.1 }, { t: 41200, x: 590, y: 440, z: 1.38 }, { t: 45400, x: 600, y: 450, z: 1.48 }], t);
          return (
            <>
              <Tag cam={c} cy={CY} px={300} py={636} text="Timecode on every note" t={t} at={41800} dy={-150} dx={40} />
              <Tag cam={c} cy={CY} px={1006} py={598} text="Draw on the frame" t={t} at={42900} dy={-90} dx={-190} tone="accent" />
            </>
          );
        })()}
      </Shot>

      {/* 9. THE CLIENT'S SIDE */}
      <Shot t={t} a={45200} b={49400 + LAP} z={19}>
        <Still name="portal" t={t} a={45200} dur={4500} from={[640, 400, 1.02]} to={[640, 520, 1.14]}>
          <Spot x={12} y={664} w={626} h={44} r={10} p={ramp(t, 47300, 450)} s={1.7} />
        </Still>
        <Tag cam={{ x: 640, y: lerp(400, 520, clamp01((t - 45200) / 4500)), z: lerp(1.02, 1.14, clamp01((t - 45200) / 4500)) }} cy={CY} px={150} py={62} text="A name. No account." t={t < 47200 ? t : 0} at={45900} dx={330} dy={0} tone="accent" />
      </Shot>

      {/* 10. BUDGET AND MARGIN */}
      <Shot t={t} a={49400} b={55200 + LAP} z={18}>
        <Screen src={frameSrc("budget", budgetF.i)} cam={camAt(budgetCam, t)} cy={CY} />
        <Lens src={frameSrc("budget", budgetF.i)} cam={camAt(budgetCam, t)} cy={CY} px={398} py={410} d={520} m={1.55} p={ramp(t, 51000, 450) * (1 - ramp(t, 52900, 220))} />
      </Shot>

      {/* 11. SCENE BUILDER */}
      <Shot t={t} a={55200} b={60200 + LAP} z={17}>
        <Footage takes={takes} name="scene" t={t} map={[[55200, 14], [56500, 45], [57100, 62], [60200, 136]]} cam={sceneCam} />
        <Tag cam={camAt(sceneCam, t)} cy={CY} px={420} py={252} text="Real bodies. Real lenses." t={t < 56400 ? t : 0} at={55500} dy={84} dx={60} tone="accent" />
      </Shot>

      {/* 12. AI PIPELINE */}
      <Shot t={t} a={60200} b={63200 + LAP} exit="cut" z={16}>
        <Still name="pipeline" t={t} a={60200} dur={3300} from={[700, 340, 1.04]} to={[760, 400, 1.3]}>
          <Spot x={258} y={316} w={990} h={156} r={12} p={ramp(t, 61200, 450)} s={1.8} />
        </Still>
      </Shot>

      {/* 13. EVERYTHING ELSE, FAST */}
      {MONTAGE.map(([name], i) => {
        const a = 63200 + i * 1100;
        return (
          <Shot key={name} t={t} a={a} b={a + 1100} enter="cut" exit="cut" z={15}>
            <Still name={name} t={t} a={a} dur={1100} from={[700, 400, 1.1]} to={[720, 420, 1.2]} />
          </Shot>
        );
      })}

      {/* 14. END CARD */}
      <Shot t={t} a={69800} b={TOUR_MS + 1} enter="zoom" exit="none" z={14}>
        <End t={t} at={69840} />
      </Shot>

      {/* CAPTIONS */}
      <Caption t={t} a={6300} b={9600} kicker="Projects" text="Every job on one board." hi={[3, 4]} />
      <Caption t={t} a={9900} b={12400} kicker="Project hub" text="One hub runs the whole job." hi={[0, 1]} />
      <Caption t={t} a={12600} b={15900} kicker="Project hub" text="Twenty-three tools. One job." hi={[2, 3]} />
      <Caption t={t} a={16200} b={20700} kicker="Moodboard" text="Moodboards you can actually move." hi={[4]} />
      <Caption t={t} a={21000} b={24300} kicker="Storyboard and shot list" text="Boards first. Then the shot list." hi={[4, 5]} />
      <Caption t={t} a={24600} b={28700} kicker="Schedule" text="Change one shot. The day re-flows." hi={[3, 4, 5]} />
      <Caption t={t} a={28900} b={30500} kicker="Schedule" text="It tells you before the day breaks." hi={[5, 6]} />
      <Caption t={t} a={30800} b={35500} kicker="Call sheets" text="See who confirmed their call." hi={[2]} />
      <Caption t={t} a={35800} b={39900} kicker="Review" text="Notes pinned to the exact spot." hi={[4, 5]} />
      <Caption t={t} a={40200} b={45100} kicker="Video review" text="Frame-accurate notes on every cut." hi={[0]} />
      <Caption t={t} a={45400} b={49300} kicker="Client portal" text="Clients approve on a link. No login." hi={[5, 6]} />
      <Caption t={t} a={49600} b={55100} kicker="Budget" text="Know what every job really made." hi={[4, 5]} />
      <Caption t={t} a={55400} b={60100} kicker="Scene builder" text="Light and frame the set in 3D." hi={[5, 6]} />
      <Caption t={t} a={60400} b={63150} kicker="AI pipeline" text="An AI video pipeline, built in." hi={[1, 2, 3]} />
      {MONTAGE.map(([name, kicker, text, hi], i) => {
        const a = 63200 + i * 1100;
        return <Caption key={name} t={t} a={a + 20} b={a + 1090} kicker={kicker} text={text} hi={hi} fast />;
      })}

      <Chrome t={t} />
    </div>
  );
}

function End({ t, at }: { t: number; at: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 132, height: 132, borderRadius: 37, background: ACCENT, display: "grid", placeItems: "center", transform: `scale(${spring(ramp(t, at + 100, 520))})`, boxShadow: "0 30px 90px color-mix(in oklch, var(--h-indigo) 60%, transparent)", marginBottom: 48 }}>
        <Mark size={78} p={ramp(t, at + 250, 700)} />
      </div>
      <Rise text="Run the whole production." t={t} at={at + 350} stagger={90} hi={[2, 3]} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 132, letterSpacing: "-0.045em", lineHeight: 1.02, color: "#fff", textAlign: "center" }} />
      <div style={{ marginTop: 26 }}>
        <Rise text="From the first brief to the final invoice." t={t} at={at + 1000} stagger={45} style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 52, letterSpacing: "-0.015em", color: "rgba(255,255,255,.8)", textAlign: "center" }} />
      </div>
      <div style={{ marginTop: 64, display: "flex", alignItems: "center", gap: 30, opacity: easeOut3(ramp(t, at + 1700, 500)), transform: `translateY(${(1 - easeOut4(ramp(t, at + 1700, 600))) * 40}px)` }}>
        <span style={{ padding: "26px 54px", borderRadius: 999, background: "#fff", color: INK, fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: "-0.02em", boxShadow: `0 0 0 ${8 + Math.sin(t / 380) * 4}px color-mix(in oklch, var(--h-indigo) 45%, transparent)` }}>Start free</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 46, letterSpacing: "-0.01em", color: GLOW }}>studio-flows.com</span>
      </div>
    </div>
  );
}

