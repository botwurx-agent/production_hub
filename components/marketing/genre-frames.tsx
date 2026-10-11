"use client";

import { useId } from "react";

/*
 * Drawn stills from the kinds of commercials a studio actually shoots: a
 * sportswear run, an auto spot on a coast road, a chef at the pass, a family
 * on a sofa, a fashion look on a seamless, two friends in a cafe, a
 * testimonial. The marketing scenes used to put one product bottle in every
 * frame, which sold the app as a pack-shot tool. Token colours only, so both
 * themes work, and clearly illustration: never a fake screenshot.
 *
 * Every still is drawn on a 300x200 grid and FILLS its box (slice), so the
 * subject is kept inside roughly x 60..240, y 40..160, which survives every
 * box the scenes put it in. `stillPoint` maps a point on that grid to pixels
 * in a box, so a pin or a drawn arrow can land on the subject exactly.
 */

export type Genre =
  | "runner"
  | "shoe"
  | "profile"
  | "steps"
  | "cafe"
  | "interview"
  | "family"
  | "car"
  | "chef"
  | "fashion"
  | "pour"
  | "endcard";

export const VB_W = 300;
export const VB_H = 200;

/** Where a point on the 300x200 grid lands in a w x h box drawn with slice. */
export function stillPoint(w: number, h: number, vx: number, vy: number) {
  const s = Math.max(w / VB_W, h / VB_H);
  return { x: (w - VB_W * s) / 2 + vx * s, y: (h - VB_H * s) / 2 + vy * s };
}

const SKIN = "color-mix(in oklch, var(--h-orange) 34%, var(--surface))";
const SKIN_D = "color-mix(in oklch, var(--h-orange) 46%, var(--text) 38%)";
const SKIN_M = "color-mix(in oklch, var(--h-orange) 50%, var(--text) 14%)";
const HAIR = "color-mix(in oklch, var(--text) 85%, var(--h-orange))";
const DARK = "var(--text)";
const mix = (a: string, pct: number, b = "var(--surface)") => `color-mix(in oklch, var(--h-${a}) ${pct}%, ${b})`;

type Pose = "stand" | "run" | "sit" | "walk";

/**
 * A person, drawn from the feet up. `s` is height in grid units over 100, `x`
 * the hip line, `y` the floor (or the seat, for "sit": then the feet hang to
 * y + 45 * s). Faces right; `flip` turns them round.
 */
function Person({
  x,
  y,
  s = 1,
  pose = "stand",
  flip = false,
  shirt,
  pants,
  skin = SKIN,
  hair = HAIR,
  long = false,
  silhouette,
}: {
  x: number;
  y: number;
  s?: number;
  pose?: Pose;
  flip?: boolean;
  shirt: string;
  pants: string;
  skin?: string;
  hair?: string;
  long?: boolean;
  silhouette?: string;
}) {
  const c = (v: string) => silhouette ?? v;
  const limb = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const lean = pose === "run" ? 10 : pose === "walk" ? 3 : 0;
  // Leg and arm joints, relative to the hip at (0,0), a 100-unit body.
  const legs =
    pose === "run"
      ? ["M0 0 L14 22 L8 44", "M0 0 L-8 22 L-26 34"]
      : pose === "walk"
        ? ["M0 0 L8 22 L12 44", "M0 0 L-5 22 L-10 44"]
        : pose === "sit"
          ? ["M0 0 L24 0 L26 44", "M-3 0 L20 2 L20 44"]
          : ["M-1 0 L-3 22 L-4 44", "M3 0 L5 22 L6 44"];
  const arms =
    pose === "run"
      ? ["M2 -34 L14 -20 L26 -28", "M-2 -34 L-14 -22 L-12 -10"]
      : pose === "walk"
        ? ["M2 -34 L8 -18 L12 -4", "M-2 -34 L-8 -18 L-10 -4"]
        : pose === "sit"
          ? ["M2 -34 L14 -18 L28 -16", "M-2 -34 L4 -16 L18 -10"]
          : ["M3 -34 L6 -18 L6 -2", "M-3 -34 L-6 -18 L-6 -2"];
  const footY = pose === "sit" ? 44 : 44;
  return (
    <g transform={`translate(${x} ${y - (pose === "sit" ? 0 : footY * s)}) scale(${flip ? -s : s} ${s})`}>
      {/* back limbs first, a shade darker */}
      <path d={legs[1]} {...limb} stroke={c(`color-mix(in oklch, ${pants} 80%, var(--text))`)} strokeWidth="9" />
      <path d={arms[1]} {...limb} stroke={c(`color-mix(in oklch, ${skin} 85%, var(--text))`)} strokeWidth="6" />
      <g transform={`rotate(${lean})`}>
        <path d="M-11 -2 Q-12 -30 -9 -40 Q0 -46 9 -40 Q12 -30 11 -2 Z" fill={c(shirt)} />
        <circle cx="0" cy="-54" r="9" fill={c(skin)} />
        <path
          d={long ? "M-9 -55 Q-11 -66 0 -65 Q11 -66 10 -55 L11 -40 Q6 -46 7 -56 Q0 -60 -7 -56 Q-6 -46 -11 -40 Z" : "M-9 -55 Q-9 -65 0 -65 Q10 -65 9 -56 Q4 -60 -2 -58 Q-6 -57 -9 -53 Z"}
          fill={c(hair)}
        />
      </g>
      <path d={legs[0]} {...limb} stroke={c(pants)} strokeWidth="9" />
      <path d={arms[0]} {...limb} stroke={c(skin)} strokeWidth="6" />
      <path d={arms[0].split(" L").slice(0, 2).join(" L")} {...limb} stroke={c(shirt)} strokeWidth="7" />
    </g>
  );
}

function Sky({ a, b, id }: { a: string; b: string; id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width={VB_W} height={VB_H} fill={`url(#${id})`} />
    </>
  );
}

/* ------------------------------------------------------------ THE STILLS */

function Runner({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("orange", 30)} b={mix("amber", 55)} />
      <circle cx="196" cy="104" r="34" fill="var(--h-yellow)" opacity=".75" />
      <path d="M0 120 Q60 96 120 112 T300 104 V200 H0 Z" fill={mix("purple", 30)} opacity=".8" />
      <path d="M0 150 Q90 118 170 136 T300 130 V200 H0 Z" fill={mix("indigo", 55, "var(--text)")} />
      <Person x={150} y={140} s={0.62} pose="run" shirt="" pants="" silhouette={mix("indigo", 30, "var(--text)")} />
    </>
  );
}

function Shoe({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("amber", 35)} b={mix("orange", 30)} />
      <path d="M0 140 Q150 128 300 140 V200 H0 Z" fill={mix("orange", 45, "var(--text) 30%")} />
      {[40, 70, 228, 260].map((x, i) => (
        <circle key={x} cx={x} cy={128 - i * 4} r={6 - i} fill={mix("amber", 40)} opacity=".7" />
      ))}
      {/* ankle and shoe, mid-stride */}
      <path d="M118 30 L130 94" stroke={SKIN_M} strokeWidth="22" strokeLinecap="round" />
      <path d="M118 84 L136 80 L140 100 L122 104 Z" fill="var(--surface)" />
      <path d="M118 96 Q128 88 146 92 L182 108 Q204 114 206 126 L206 132 Q150 136 104 128 Q100 110 118 96 Z" fill="var(--accent)" />
      <path d="M102 128 Q150 140 208 132 L208 140 Q150 146 100 136 Z" fill="var(--surface)" />
      <path d="M140 98 L132 110 M152 100 L144 113 M164 104 L156 116" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" />
      <path d="M86 128 Q60 132 40 126" stroke={mix("amber", 40)} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".7" />
    </>
  );
}

function Profile({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("blue", 28)} b={mix("cyan", 22)} />
      <circle cx="70" cy="70" r="40" fill="var(--surface)" opacity=".35" />
      {/* shoulder and shirt */}
      <path d="M70 200 Q80 150 130 146 L190 146 Q236 150 246 200 Z" fill="var(--h-pink)" />
      <path d="M140 126 L176 126 L178 150 L140 152 Z" fill={SKIN_D} />
      {/* head in profile, facing right */}
      <path
        d="M118 86 Q118 46 156 42 Q192 40 198 72 Q200 80 206 88 Q210 94 204 96 L202 104 Q206 108 200 112 Q200 124 186 128 L160 132 Q130 132 120 110 Q116 98 118 86 Z"
        fill={SKIN_D}
      />
      <path d="M118 90 Q112 46 152 38 Q190 32 200 66 Q178 56 164 60 Q150 62 142 82 Q132 80 130 96 Q122 98 118 90 Z" fill={HAIR} />
      <circle cx="146" cy="90" r="5" fill="var(--text)" opacity=".85" />
      <circle cx="146" cy="90" r="2.4" fill="var(--surface)" />
      {/* breath in the cold */}
      {[0, 1, 2].map((k) => (
        <circle key={k} cx={222 + k * 16} cy={102 - k * 4} r={7 + k * 3} fill="var(--surface)" opacity={0.55 - k * 0.15} />
      ))}
    </>
  );
}

function Steps({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("blue", 25)} b={mix("indigo", 18)} />
      {[
        [10, 30, 40, 120],
        [56, 52, 34, 98],
        [214, 24, 46, 126],
        [262, 60, 38, 90],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill={mix("indigo", 35, "var(--surface-2)")} />
          {[0, 1, 2, 3].map((r) => (
            <rect key={r} x={x + 6} y={y + 10 + r * 22} width={w - 12} height="8" fill={mix("yellow", 50)} opacity=".6" />
          ))}
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={70 + i * 10} y={190 - i * 12} width={170 - i * 10} height="12" fill={i % 2 ? mix("orange", 18, "var(--surface-2)") : mix("orange", 28, "var(--surface-2)")} />
      ))}
      <Person x={150} y={118} s={0.5} pose="run" shirt="var(--h-green)" pants={DARK} skin={SKIN_D} />
    </>
  );
}

function Cafe({ uid }: { uid: string }) {
  return (
    <>
      <rect width={VB_W} height={VB_H} fill={mix("amber", 20)} />
      {/* the window behind them */}
      <rect x="40" y="20" width="220" height="100" rx="4" fill={mix("cyan", 30)} />
      <path d="M150 20 V120 M40 70 H260" stroke={mix("amber", 40, "var(--text) 30%")} strokeWidth="4" />
      <circle cx="90" cy="48" r="12" fill={mix("green", 45)} />
      <circle cx="226" cy="96" r="16" fill={mix("green", 45)} />
      <rect x="0" y="120" width={VB_W} height="80" fill={mix("amber", 38)} />
      <Person x={104} y={148} s={0.82} pose="sit" shirt="var(--h-blue)" pants={mix("indigo", 50, "var(--text)")} skin={SKIN} long />
      <Person x={196} y={148} s={0.82} pose="sit" flip shirt="var(--h-amber)" pants={mix("orange", 30, "var(--text)")} skin={SKIN_D} />
      {/* table and cups */}
      <rect x="114" y="128" width="72" height="8" rx="3" fill={mix("orange", 55, "var(--text) 25%")} />
      <path d="M150 136 V186" stroke={mix("orange", 55, "var(--text) 25%")} strokeWidth="5" />
      <rect x="128" y="117" width="12" height="11" rx="2" fill="var(--surface)" />
      <rect x="160" y="117" width="12" height="11" rx="2" fill="var(--surface)" />
    </>
  );
}

function Interview({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("indigo", 22, "var(--surface-2)")} b={mix("purple", 18, "var(--surface-2)")} />
      {[
        [40, 40, 14],
        [70, 76, 9],
        [250, 50, 12],
        [270, 92, 7],
        [32, 120, 8],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--h-yellow)" opacity=".35" />
      ))}
      {/* practical lamp */}
      <circle cx="74" cy="92" r="26" fill="var(--h-yellow)" opacity=".25" />
      <path d="M62 82 H86 L80 98 H68 Z" fill={mix("amber", 60)} />
      <path d="M74 98 V170" stroke="var(--text)" strokeWidth="3" opacity=".7" />
      {/* plant */}
      <path d="M240 170 Q236 120 252 104 M244 140 Q226 124 222 112 M248 130 Q266 118 272 108" stroke={mix("green", 70, "var(--text) 20%")} strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* chair and subject */}
      <rect x="118" y="88" width="66" height="74" rx="10" fill={mix("orange", 40, "var(--text) 30%")} />
      <Person x={150} y={146} s={0.95} pose="sit" shirt="var(--h-cyan)" pants={mix("blue", 40, "var(--text)")} skin={SKIN_M} long />
      <rect x="0" y="190" width={VB_W} height="10" fill="var(--text)" opacity=".15" />
    </>
  );
}

function Family({ uid }: { uid: string }) {
  return (
    <>
      <rect width={VB_W} height={VB_H} fill={mix("amber", 16)} />
      <rect x="196" y="22" width="76" height="86" rx="3" fill={mix("cyan", 28)} />
      <path d="M234 22 V108" stroke={mix("amber", 30, "var(--text) 25%")} strokeWidth="3" />
      {/* lamp */}
      <circle cx="48" cy="72" r="24" fill="var(--h-yellow)" opacity=".28" />
      <path d="M36 62 H60 L54 80 H42 Z" fill={mix("amber", 55)} />
      <path d="M48 80 V150" stroke="var(--text)" strokeWidth="3" opacity=".6" />
      {/* the sofa */}
      <rect x="64" y="96" width="172" height="40" rx="12" fill={mix("green", 45, "var(--text) 12%")} />
      <rect x="58" y="112" width="20" height="50" rx="8" fill={mix("green", 55, "var(--text) 18%")} />
      <rect x="222" y="112" width="20" height="50" rx="8" fill={mix("green", 55, "var(--text) 18%")} />
      <path d="M58 114 Q66 104 80 110 L78 132 L60 130 Z" fill={mix("pink", 55)} />
      <Person x={104} y={134} s={0.72} pose="sit" shirt="var(--h-purple)" pants={mix("indigo", 45, "var(--text)")} skin={SKIN_D} />
      <Person x={150} y={136} s={0.5} pose="sit" shirt="var(--h-yellow)" pants={mix("blue", 40)} skin={SKIN_D} long />
      <Person x={192} y={134} s={0.72} pose="sit" flip shirt="var(--h-red)" pants={mix("orange", 40, "var(--text)")} skin={SKIN} long />
      <rect x="66" y="134" width="168" height="26" rx="8" fill={mix("green", 50, "var(--text) 15%")} />
      <ellipse cx="150" cy="186" rx="120" ry="12" fill={mix("orange", 30)} />
    </>
  );
}

function Car({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("blue", 32)} b={mix("cyan", 22)} />
      <circle cx="238" cy="58" r="16" fill="var(--h-yellow)" opacity=".7" />
      <rect x="0" y="92" width={VB_W} height="40" fill={mix("cyan", 55)} />
      <path d="M0 92 Q40 70 90 80 Q120 84 140 92 Z" fill={mix("green", 45, "var(--text) 20%")} />
      <path d="M0 128 Q150 112 300 120 V200 H0 Z" fill={mix("orange", 30, "var(--surface-2)")} />
      <path d="M0 150 Q150 128 300 138 L300 160 Q150 150 0 172 Z" fill={mix("indigo", 20, "var(--text) 70%")} />
      <path d="M0 162 Q150 140 300 149" stroke="var(--h-yellow)" strokeWidth="2" strokeDasharray="10 8" fill="none" />
      {/* the car, side on, heading left */}
      <g transform="translate(150 144)">
        <path d="M-58 0 Q-60 -14 -46 -16 L-30 -18 Q-18 -34 4 -34 L22 -34 Q36 -32 44 -18 L56 -14 Q64 -10 62 0 Z" fill="var(--h-red)" />
        <path d="M-24 -18 Q-14 -30 2 -30 L8 -30 L8 -18 Z M12 -30 L22 -30 Q32 -28 38 -18 L12 -18 Z" fill={mix("cyan", 40)} />
        <circle cx="-34" cy="0" r="10" fill="var(--text)" />
        <circle cx="38" cy="0" r="10" fill="var(--text)" />
        <circle cx="-34" cy="0" r="4" fill="var(--surface)" />
        <circle cx="38" cy="0" r="4" fill="var(--surface)" />
        <path d="M-58 -8 H-50" stroke="var(--h-yellow)" strokeWidth="3" strokeLinecap="round" />
      </g>
      {[0, 1, 2].map((k) => (
        <path key={k} d={`M${222 + k * 8} ${132 + k * 5} H${252 + k * 12}`} stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" opacity={0.6 - k * 0.15} />
      ))}
    </>
  );
}

function Chef({ uid }: { uid: string }) {
  return (
    <>
      <rect width={VB_W} height={VB_H} fill={mix("orange", 14, "var(--surface-2)")} />
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => (
          <rect key={`${r}${c}`} x={c * 31 + (r % 2) * 15 - 10} y={r * 18} width="29" height="16" rx="2" fill="var(--surface)" opacity=".55" />
        )),
      )}
      {/* chef, waist up behind the pass */}
      <path d="M118 128 Q118 82 150 80 Q182 82 182 128 Z" fill="var(--surface)" stroke={mix("orange", 25, "var(--text) 15%")} strokeWidth="1.5" />
      <path d="M150 84 V126 M144 96 h0 M144 110 h0" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" opacity=".4" />
      <circle cx="150" cy="64" r="16" fill={SKIN_M} />
      <path d="M134 52 Q130 30 150 32 Q170 30 166 52 Z" fill="var(--surface)" stroke={mix("orange", 25, "var(--text) 15%")} strokeWidth="1.5" />
      {/* arms down to the plate */}
      <path d="M124 100 L120 126 L136 136" stroke="var(--surface)" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M176 100 L182 126 L166 134" stroke="var(--surface)" strokeWidth="11" strokeLinecap="round" fill="none" />
      <circle cx="139" cy="137" r="5" fill={SKIN_M} />
      <circle cx="163" cy="135" r="5" fill={SKIN_M} />
      <path d="M163 135 L152 146" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
      {/* the pass, the plate, the food */}
      <rect x="0" y="146" width={VB_W} height="54" fill={mix("indigo", 10, "var(--text) 35%")} />
      <ellipse cx="150" cy="150" rx="46" ry="12" fill="var(--surface)" />
      <ellipse cx="150" cy="149" rx="30" ry="7" fill={mix("orange", 45)} />
      <circle cx="140" cy="146" r="4" fill="var(--h-green)" />
      <circle cx="156" cy="145" r="3.5" fill="var(--h-red)" />
      <circle cx="148" cy="143" r="3" fill="var(--h-green)" />
      {/* steam */}
      <path d="M140 132 q-6 -8 0 -16 q6 -8 0 -16 M160 130 q-6 -8 0 -16 q6 -8 0 -16" stroke="var(--surface)" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
    </>
  );
}

function Fashion({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("pink", 24)} b={mix("pink", 12, "var(--surface-2)")} />
      <ellipse cx="150" cy="176" rx="130" ry="18" fill={mix("pink", 30)} opacity=".7" />
      {/* softbox on a stand, just in frame */}
      <path d="M44 40 L76 30 L80 82 L48 92 Z" fill="var(--surface)" stroke={mix("pink", 30, "var(--text) 40%")} strokeWidth="2" />
      <path d="M64 86 V180 M64 180 L50 194 M64 180 L78 194" stroke="var(--text)" strokeWidth="2.5" opacity=".6" />
      <ellipse cx="150" cy="178" rx="26" ry="5" fill="var(--text)" opacity=".18" />
      {/* the look: long coat */}
      <Person x={150} y={178} s={1.2} pose="stand" shirt="var(--h-indigo)" pants={mix("indigo", 60, "var(--text)")} skin={SKIN_D} long />
      <path d="M134 98 Q150 94 166 98 L174 150 Q150 156 126 150 Z" fill="var(--h-orange)" />
      <path d="M150 98 V152" stroke={mix("orange", 70, "var(--text) 20%")} strokeWidth="2" />
    </>
  );
}

function Pour({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={`${uid}s`} a={mix("cyan", 28)} b={mix("blue", 20)} />
      <ellipse cx="150" cy="176" rx="130" ry="14" fill="var(--surface)" opacity=".6" />
      <g transform="translate(118 64) rotate(118)">
        <rect x="-9" y="-6" width="18" height="10" rx="3" fill="var(--h-indigo)" />
        <path d="M-12 4 h24 q8 12 8 24 v50 h-40 v-50 q0 -12 8 -24z" fill="var(--h-blue)" opacity=".9" />
        <rect x="-14" y="34" width="28" height="22" rx="3" fill="var(--surface)" />
      </g>
      <path d="M124 72 Q132 110 150 150" stroke={mix("cyan", 70)} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M128 120 h44 l-6 50 q-1 6 -7 6 h-18 q-6 0 -7 -6z" fill="var(--surface)" opacity=".8" stroke="var(--h-cyan)" strokeWidth="2" />
      <path d="M131 146 h38 l-3 24 q-1 6 -7 6 h-18 q-6 0 -7 -6z" fill={mix("cyan", 55)} />
    </>
  );
}

function Endcard() {
  return (
    <>
      <rect width={VB_W} height={VB_H} fill="var(--text)" />
      <circle cx="150" cy="84" r="18" fill="none" stroke="var(--accent)" strokeWidth="5" />
      <path d="M140 84 l7 7 l13 -14" stroke="var(--surface)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="104" y="116" width="92" height="9" rx="4" fill="var(--surface)" opacity=".9" />
      <rect x="122" y="132" width="56" height="6" rx="3" fill="var(--surface)" opacity=".45" />
    </>
  );
}

function Body({ genre, uid }: { genre: Genre; uid: string }) {
  switch (genre) {
    case "runner":
      return <Runner uid={uid} />;
    case "shoe":
      return <Shoe uid={uid} />;
    case "profile":
      return <Profile uid={uid} />;
    case "steps":
      return <Steps uid={uid} />;
    case "cafe":
      return <Cafe uid={uid} />;
    case "interview":
      return <Interview uid={uid} />;
    case "family":
      return <Family uid={uid} />;
    case "car":
      return <Car uid={uid} />;
    case "chef":
      return <Chef uid={uid} />;
    case "fashion":
      return <Fashion uid={uid} />;
    case "pour":
      return <Pour uid={uid} />;
    default:
      return <Endcard />;
  }
}

/**
 * One still, filling its box. `grade` washes the whole frame warmer or
 * cooler, which is how a revision ("warmer in v4") reads at a glance.
 * `sketch` draws it as pencil lines on paper, for a storyboard frame.
 */
export function GenreStill({ genre, grade, sketch = false, id }: { genre: Genre; grade?: "warm" | "cool" | "dusk"; sketch?: boolean; id?: string }) {
  const auto = useId().replace(/[^a-zA-Z0-9]/g, "");
  const uid = id ?? `gs${auto}`;
  return (
    // A photograph does not change with the app's theme, and a frame under
    // review should sit in a stable light (section 4.3), so the tokens inside
    // a still are always read in the light set.
    <svg data-theme="light" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 h-full w-full ${sketch ? "gs-sketch" : ""}`} aria-hidden="true">
      {sketch ? (
        <style>{`.gs-sketch .gs-body *{fill:none!important;stroke:var(--text-faint)!important;stroke-width:2.2px!important}`}</style>
      ) : null}
      {sketch ? <rect width={VB_W} height={VB_H} fill="var(--surface)" /> : null}
      <g className="gs-body">
        <Body genre={genre} uid={uid} />
      </g>
      {grade === "warm" ? <rect width={VB_W} height={VB_H} fill="var(--h-orange)" opacity=".16" /> : null}
      {grade === "cool" ? <rect width={VB_W} height={VB_H} fill="var(--h-blue)" opacity=".16" /> : null}
      {grade === "dusk" ? <rect width={VB_W} height={VB_H} fill="var(--h-purple)" opacity=".2" /> : null}
    </svg>
  );
}

/**
 * The spot the shot list, storyboard and hub scenes are about: "First light",
 * a sportswear commercial that follows one runner from a dawn ridge to coffee
 * with a friend and home. Live action, people first, product last.
 */
export const SPOT: { genre: Genre; desc: string }[] = [
  { genre: "runner", desc: "Dawn, a runner on the ridge" },
  { genre: "shoe", desc: "The shoe hits the trail" },
  { genre: "profile", desc: "Her breath in the cold" },
  { genre: "steps", desc: "Up the city steps" },
  { genre: "cafe", desc: "Coffee with a friend after" },
  { genre: "interview", desc: "She tells us why she runs" },
  { genre: "family", desc: "Home, the kids awake" },
  { genre: "endcard", desc: "End card and logo" },
];
