// Lighting for the Scene Setup PROTOTYPE: fixtures, modifiers, diffusion,
// photometry and exposure. Pure maths, no three.js and no "server-only", so it
// is testable and so the light meter and the render agree: both read the same
// intensity and the same cone falloff from here.
//
// UNITS ARE REAL. Fixtures are rated in lumens, a source's strength along its
// axis is in candela, light at a point is in lux, a glowing surface is in nits.
// The scene renders in those units and the CAMERA turns them into an image
// through ISO, stop, shutter and ND, exactly as a real one does. That is what
// makes "the key reads f/4" a statement the prototype can actually make.
//
// HONEST LIMITS, stated so nobody mistakes this for a light meter on set:
// lumen figures are approximate per fixture class, light bouncing round the
// room is a single averaged estimate, and diffusion is modelled as how much it
// passes and how much it spreads, not as the fabric's real scattering curve.
// Read results as RELATIVE ("a stop hotter", "much softer"), never as gospel.

export type FixtureKind = "cob" | "panel" | "fresnel" | "hmi" | "tube" | "lantern" | "mini";

export type Fixture = {
  id: string;
  name: string;
  kind: FixtureKind;
  /** Rated output at full, approximate. */
  lumens: number;
  cctMin: number;
  cctMax: number;
  cctDefault: number;
  /** The light-emitting face with no modifier, in metres. */
  faceW: number;
  faceH: number;
  modifiers: string[];
  defaultModifier: string;
  /** An RGBWW engine: it can make a saturated colour as well as white. */
  rgb?: boolean;
};

/**
 * A colour an RGB fixture is making, in its HSI mode: hue in degrees, and how
 * saturated (0 is the fixture's white at its CCT, 1 is the pure colour).
 * Absent means CCT mode, white at the CCT.
 */
export type LightColor = { hue: number; sat: number };

export const FIXTURES: Fixture[] = [
  { id: "ls1200d", name: "Aputure LS 1200d Pro", kind: "cob", lumens: 80000, cctMin: 5600, cctMax: 5600, cctDefault: 5600, faceW: 0.22, faceH: 0.22, modifiers: ["reflector", "dome", "softbox", "strip", "lantern"], defaultModifier: "dome" },
  { id: "ls600d", name: "Aputure LS 600d Pro", kind: "cob", lumens: 40000, cctMin: 5600, cctMax: 5600, cctDefault: 5600, faceW: 0.18, faceH: 0.18, modifiers: ["reflector", "dome", "softbox", "strip", "lantern"], defaultModifier: "dome" },
  { id: "ls300x", name: "Aputure LS 300x", kind: "cob", lumens: 18000, cctMin: 2700, cctMax: 6500, cctDefault: 5600, faceW: 0.15, faceH: 0.15, modifiers: ["reflector", "dome", "softbox", "strip", "lantern"], defaultModifier: "reflector" },
  { id: "ls600c", name: "Aputure LS 600c Pro", kind: "cob", lumens: 28000, cctMin: 2300, cctMax: 10000, cctDefault: 5600, faceW: 0.18, faceH: 0.18, modifiers: ["reflector", "dome", "softbox", "strip", "lantern"], defaultModifier: "dome", rgb: true },
  { id: "novap600c", name: "Aputure Nova P600c", kind: "panel", lumens: 22000, cctMin: 2300, cctMax: 10000, cctDefault: 5600, faceW: 0.64, faceH: 0.3, modifiers: ["diffuser", "grid"], defaultModifier: "diffuser", rgb: true },
  { id: "novap300c", name: "Aputure Nova P300c", kind: "panel", lumens: 11000, cctMin: 2300, cctMax: 10000, cctDefault: 5600, faceW: 0.44, faceH: 0.24, modifiers: ["diffuser", "grid"], defaultModifier: "diffuser", rgb: true },
  { id: "s60", name: "ARRI SkyPanel S60-C", kind: "panel", lumens: 12000, cctMin: 2800, cctMax: 10000, cctDefault: 5600, faceW: 0.65, faceH: 0.3, modifiers: ["diffuser", "grid"], defaultModifier: "diffuser", rgb: true },
  { id: "s30", name: "ARRI SkyPanel S30-C", kind: "panel", lumens: 6000, cctMin: 2800, cctMax: 10000, cctDefault: 5600, faceW: 0.33, faceH: 0.3, modifiers: ["diffuser", "grid"], defaultModifier: "diffuser", rgb: true },
  { id: "m18", name: "ARRI M18 HMI", kind: "hmi", lumens: 150000, cctMin: 5600, cctMax: 5600, cctDefault: 5600, faceW: 0.42, faceH: 0.42, modifiers: ["reflector", "fresnel"], defaultModifier: "reflector" },
  { id: "arri650", name: "ARRI 650 Plus (tungsten)", kind: "fresnel", lumens: 14000, cctMin: 3200, cctMax: 3200, cctDefault: 3200, faceW: 0.16, faceH: 0.16, modifiers: ["fresnel"], defaultModifier: "fresnel" },
  { id: "mcpro", name: "Aputure MC Pro", kind: "mini", lumens: 450, cctMin: 2000, cctMax: 10000, cctDefault: 5600, faceW: 0.12, faceH: 0.065, modifiers: ["bare", "diffuser"], defaultModifier: "bare", rgb: true },
  { id: "titan", name: "Astera Titan Tube", kind: "tube", lumens: 2000, cctMin: 1750, cctMax: 20000, cctDefault: 5600, faceW: 0.05, faceH: 1.0, modifiers: ["bare"], defaultModifier: "bare", rgb: true },
  { id: "chinaball", name: "China ball (26\")", kind: "lantern", lumens: 4000, cctMin: 3200, cctMax: 3200, cctDefault: 3200, faceW: 0.66, faceH: 0.66, modifiers: ["bare"], defaultModifier: "bare" },
];

export type Modifier = {
  id: string;
  name: string;
  /** Full beam angle in degrees; 180 means it radiates like a flat glowing card. */
  beamDeg: number;
  /** Share of the fixture's output that leaves the modifier. */
  efficiency: number;
  /** Size of the glowing face it creates, or null to keep the fixture's own. */
  faceW: number | null;
  faceH: number | null;
  omni?: boolean;
  /** Fresnel only: the beam angle can be spotted and flooded between these. */
  spotFlood?: [number, number];
};

export const MODIFIERS: Record<string, Modifier> = {
  bare: { id: "bare", name: "Bare", beamDeg: 120, efficiency: 0.9, faceW: null, faceH: null },
  reflector: { id: "reflector", name: "Reflector", beamDeg: 55, efficiency: 0.75, faceW: 0.3, faceH: 0.3 },
  dome: { id: "dome", name: "Light Dome (36\")", beamDeg: 180, efficiency: 0.45, faceW: 0.9, faceH: 0.9 },
  softbox: { id: "softbox", name: "Softbox 4x4", beamDeg: 180, efficiency: 0.4, faceW: 1.2, faceH: 1.2 },
  strip: { id: "strip", name: "Stripbox 1x4", beamDeg: 180, efficiency: 0.4, faceW: 0.3, faceH: 1.2 },
  lantern: { id: "lantern", name: "Lantern", beamDeg: 360, efficiency: 0.5, faceW: 0.65, faceH: 0.65, omni: true },
  diffuser: { id: "diffuser", name: "Standard diffuser", beamDeg: 180, efficiency: 0.7, faceW: null, faceH: null },
  grid: { id: "grid", name: "Honeycomb 30°", beamDeg: 60, efficiency: 0.5, faceW: null, faceH: null },
  fresnel: { id: "fresnel", name: "Fresnel lens", beamDeg: 35, efficiency: 0.55, faceW: null, faceH: null, spotFlood: [12, 60] },
};

export type DiffusionMaterial = {
  id: string;
  name: string;
  /** Share of light that gets through: the material's rated loss. */
  transmission: number;
  /** Of what gets through, the share that keeps going in the fixture's own
   * beam (the hot spot you see through it). The rest is scattered and leaves
   * the frame as an even glowing card. Opal keeps most of the beam, which is
   * why it softens only a little; full grid keeps none of it. */
  through: number;
};

export const DIFFUSIONS: DiffusionMaterial[] = [
  { id: "opal", name: "Opal", transmission: 0.8, through: 0.85 },
  { id: "quarter-grid", name: "1/4 Grid", transmission: 0.72, through: 0.5 },
  { id: "half-grid", name: "1/2 Grid", transmission: 0.5, through: 0.15 },
  { id: "silk", name: "Silk", transmission: 0.5, through: 0.25 },
  { id: "216", name: "216", transmission: 0.36, through: 0.05 },
  { id: "full-grid", name: "Full Grid", transmission: 0.28, through: 0 },
];

/** Frame sizes in feet, as they are ordered from a grip house. */
export const FRAME_SIZES = [4, 6, 8, 12, 20];
export const FT = 0.3048;

export type FrameSpec = { sizeFt: number; materialId: string; distM: number };

export const ND_STEPS = [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1];
export const ISOS = [400, 640, 800, 1280, 1600, 3200];
export const WHITE_BALANCES = [3200, 4300, 5600, 6500];
/** 180 degree shutter at 24 frames, the default nobody has to think about. */
export const SHUTTER_SEC = 1 / 48;
/** Incident meter calibration constant (lux seconds). */
export const METER_C = 250;

const D2R = Math.PI / 180;

/** Solid angle of a cone with the given full beam angle. */
export function coneSolidAngle(beamDeg: number): number {
  const half = Math.min(beamDeg, 359) / 2;
  return 2 * Math.PI * (1 - Math.cos(half * D2R));
}

/**
 * Candela along the axis. A source wider than 150 degrees is treated as a
 * glowing card (a softbox face, a panel's diffuser), whose axial intensity is
 * output over pi; an omni source spreads over the whole sphere.
 */
export function axisCandela(lumens: number, beamDeg: number, omni = false): number {
  if (!(lumens > 0)) return 0;
  if (omni || beamDeg >= 359) return lumens / (4 * Math.PI);
  if (beamDeg >= 150) return lumens / Math.PI;
  return lumens / coneSolidAngle(beamDeg);
}

/**
 * The spot cone the renderer draws, and the SAME falloff the meter uses, so a
 * reading can never disagree with the picture. three.js lights a spot with
 * smoothstep(cos(angle), cos(angle * (1 - penumbra)), cos(theta)).
 */
export function spotCone(beamDeg: number): { angle: number; penumbra: number } {
  if (beamDeg >= 150) return { angle: 89 * D2R, penumbra: 1 };
  return { angle: Math.min(89, (beamDeg / 2) * 1.25) * D2R, penumbra: 0.45 };
}

export function coneFalloff(angle: number, penumbra: number, thetaFromAxis: number): number {
  const lo = Math.cos(angle);
  const hi = Math.cos(angle * (1 - penumbra));
  const c = Math.cos(thetaFromAxis);
  if (hi === lo) return c >= hi ? 1 : 0;
  const t = Math.max(0, Math.min(1, (c - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

export type SourceResult = {
  /** Candela along the axis at the dimmer setting. */
  candela: number;
  beamDeg: number;
  omni: boolean;
  /** Size of the glowing area the subject actually sees, in metres. */
  sourceW: number;
  sourceH: number;
  /** Where that area sits along the light's axis, metres from the fixture. */
  offsetM: number;
  /** Lumens leaving into the room, for the room bounce estimate. */
  flux: number;
  /** How bright the glowing face looks, for drawing it (nits). */
  faceNits: number;
  /**
   * With a diffusion frame, the part of the beam that goes straight through
   * the cloth. It still starts AT THE FIXTURE (offset 0), so it falls off over
   * the full distance to the subject, while the glow above starts at the
   * frame. Treating both as starting at the frame made diffusion read
   * brighter than no diffusion at all.
   */
  through: { candela: number; beamDeg: number; sizeM: number } | null;
  /** The beam to draw on the map: the fixture's when most light goes through. */
  shownBeamDeg: number;
};

/**
 * A fixture with its modifier, its dimmer, and optionally a diffusion frame in
 * front of it, reduced to the source the subject sees.
 *
 * The frame is the part that behaves like the real thing. The fixture lights a
 * patch of the frame whose size depends on the beam and the distance, and that
 * patch becomes the source: pull the frame away from the light and the patch
 * grows (softer, dimmer per square foot); push it in and it shrinks (harder,
 * brighter). A weak diffuser lets part of the fixture show through as a hot
 * spot, which is what `through` carries. Beam spilling round a frame too small
 * for it is not modelled; the readout says so.
 */
export function resolveSource(
  fixture: Fixture,
  modifierId: string,
  dimmer: number,
  beamOverride: number | null,
  frame: FrameSpec | null,
): SourceResult {
  const mod = MODIFIERS[modifierId] ?? MODIFIERS[fixture.defaultModifier] ?? MODIFIERS.bare;
  const dim = Math.max(0, Math.min(1, dimmer));
  let beam = mod.beamDeg;
  if (mod.spotFlood && beamOverride != null) {
    beam = Math.max(mod.spotFlood[0], Math.min(mod.spotFlood[1], beamOverride));
  }
  if (fixture.kind === "tube") beam = 160;
  const omni = !!mod.omni || fixture.kind === "lantern";
  const flux = fixture.lumens * dim * mod.efficiency;
  const w = mod.faceW ?? fixture.faceW;
  const h = mod.faceH ?? fixture.faceH;
  const cd = axisCandela(flux, beam, omni);

  if (!frame || omni) {
    return {
      candela: cd, beamDeg: omni ? 360 : beam, omni, sourceW: w, sourceH: h, offsetM: 0, flux,
      faceNits: cd / Math.max(0.01, w * h), through: null, shownBeamDeg: omni ? 360 : beam,
    };
  }

  const mat = DIFFUSIONS.find((d) => d.id === frame.materialId) ?? DIFFUSIONS[2];
  const side = frame.sizeFt * FT;
  const d = Math.max(0.2, frame.distM);
  const r = d * Math.tan((Math.min(beam, 170) / 2) * D2R);
  const litSide = Math.min(side, Math.sqrt(Math.PI) * r);
  const litArea = litSide * litSide;
  // Light landing on the frame, then what it re-emits as a glowing card.
  // On-axis illuminance times area overstates it for a wide source close to
  // a big frame (it would catch more than the fixture puts out), so it is
  // capped by the solid angle the frame subtends and by the fixture's flux.
  const eFrame = cd / (d * d);
  const half = litSide / 2;
  const omega = 4 * Math.asin((half * half) / (half * half + d * d));
  const caught = Math.min(eFrame * litArea, cd * omega, flux);
  // What is scattered leaves the cloth as an even (Lambertian) glow; what
  // keeps going stays in the fixture's beam, from the fixture's position.
  const scattered = ((1 - mat.through) * mat.transmission * caught) / Math.PI;
  const direct = mat.through * mat.transmission * cd;
  return {
    candela: scattered,
    beamDeg: 180,
    omni: false,
    sourceW: litSide,
    sourceH: litSide,
    offsetM: d,
    flux: flux * mat.transmission,
    faceNits: (mat.transmission * caught) / (Math.PI * litArea),
    through: direct > 0 ? { candela: direct, beamDeg: beam, sizeM: Math.max(w, h) } : null,
    shownBeamDeg: direct > scattered ? beam : 180,
  };
}

/** How soft a source looks from the subject: its angular size. */
export function apparentSizeDeg(sourceM: number, distanceM: number): number {
  return (2 * Math.atan(sourceM / 2 / Math.max(0.05, distanceM))) / D2R;
}

export function softness(deg: number): string {
  if (deg >= 45) return "Very soft";
  if (deg >= 22) return "Soft";
  if (deg >= 9) return "Medium";
  return "Hard";
}

/** Shadow blur for the renderer, in shadow-map texels, from apparent size. */
export function shadowBlur(deg: number): number {
  return Math.max(1, Math.min(24, deg * 0.45));
}

/** Lux needed for a correct exposure on an incident meter. */
export function luxForStop(stop: number, iso: number, ndOptical = 0, shutterSec = SHUTTER_SEC): number {
  return (METER_C * stop * stop * Math.pow(10, ndOptical)) / (shutterSec * iso);
}

/** Stops over (+) or under (-) a correct exposure. */
export function stopsOver(lux: number, stop: number, iso: number, ndOptical = 0, shutterSec = SHUTTER_SEC): number {
  if (!(lux > 0)) return -Infinity;
  return Math.log2(lux / luxForStop(stop, iso, ndOptical, shutterSec));
}

/** The stop a reading calls for, with no ND. */
export function readsAt(lux: number, iso: number, shutterSec = SHUTTER_SEC): number {
  return Math.sqrt((Math.max(0, lux) * shutterSec * iso) / METER_C);
}

const THIRDS = [1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];

/** A stop written the way a meter shows it, to the nearest third. */
export function stopLabel(n: number): string {
  if (!(n > 0)) return "below f/1";
  if (n > 22) return "over f/22";
  let best = THIRDS[0];
  for (const t of THIRDS) if (Math.abs(Math.log2(t / n)) < Math.abs(Math.log2(best / n))) best = t;
  return `f/${best}`;
}

export function stopsLabel(s: number): string {
  if (!Number.isFinite(s)) return "no light";
  if (Math.abs(s) < 0.17) return "on the stop";
  const v = Math.abs(s);
  const r = Math.round(v * 10) / 10;
  return `${s > 0 ? "+" : "-"}${r} ${r === 1 ? "stop" : "stops"}`;
}

/**
 * The renderer's exposure multiplier. Scene values are nits, and a grey card
 * lit to exactly the right exposure (luxForStop) must land at 18 percent.
 */
export function exposureScale(stop: number, iso: number, ndOptical = 0, shutterSec = SHUTTER_SEC): number {
  const nitsOfGrey = (luxForStop(stop, iso, ndOptical, shutterSec) * 0.18) / Math.PI;
  return 0.18 / nitsOfGrey;
}

/** ND that brings a reading closest to the stop, from the steps a DP carries. */
export function bestNd(lux: number, stop: number, iso: number): number {
  let best = 0;
  let err = Infinity;
  for (const nd of ND_STEPS) {
    const e = Math.abs(stopsOver(lux, stop, iso, nd));
    if (e < err) { err = e; best = nd; }
  }
  return best;
}

/**
 * Colour of a black body at K, linear RGB with luminance 1. Tanner Helland's
 * fit, good to a few percent over 1000 to 40000K.
 */
export function kelvinRgb(k: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const lin = (v: number) => {
    const c = Math.max(0, Math.min(255, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const out: [number, number, number] = [lin(r), lin(g), lin(b)];
  const y = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
  return [out[0] / y, out[1] / y, out[2] / y];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const luma = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** A fully saturated hue, linear RGB with its brightest channel at 1. */
export function hueRgb(hueDeg: number): [number, number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] =
    h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function clampColor(c: LightColor): LightColor {
  const hue = Number.isFinite(c.hue) ? (((c.hue % 360) + 360) % 360) : 0;
  const sat = Number.isFinite(c.sat) ? Math.max(0, Math.min(1, c.sat)) : 0;
  return { hue, sat };
}

/**
 * The light a fixture actually emits: white at its CCT, or in HSI mode its
 * white mixed toward a saturated hue. Luminance 1, so colour and output are
 * kept apart (output is `colorOutput`).
 */
export function lightRgb(cct: number, color: LightColor | null | undefined): [number, number, number] {
  const w = kelvinRgb(cct);
  if (!color) return w;
  const { hue, sat } = clampColor(color);
  const wm = Math.max(...w);
  const p = hueRgb(hue);
  const mix: [number, number, number] = [
    (1 - sat) * (w[0] / wm) + sat * p[0],
    (1 - sat) * (w[1] / wm) + sat * p[1],
    (1 - sat) * (w[2] / wm) + sat * p[2],
  ];
  const y = luma(mix) || 1;
  return [mix[0] / y, mix[1] / y, mix[2] / y];
}

/**
 * The share of a fixture's white output it can still make at this colour.
 * A saturated colour runs only some of the emitters, so a deep blue is a
 * small fraction of the white figure and a green a large one. Weighted by
 * luminance, which is what a meter reads; the floor stops a deep blue from
 * reading as off. Approximate, like every lumen figure here.
 */
export function colorOutput(color: LightColor | null | undefined): number {
  if (!color) return 1;
  const { hue, sat } = clampColor(color);
  const pure = Math.max(0.06, luma(hueRgb(hue)));
  return (1 - sat) + sat * pure;
}

/** The dimmer a fixture effectively runs at once its colour has cost output. */
export function lightOutput(s: { dimmer: number; color?: LightColor | null }, f: Fixture): number {
  return s.dimmer * (f.rgb ? colorOutput(s.color) : 1);
}

/** Named colours a gaffer asks for, as hues. */
export const COLOR_PRESETS: { name: string; hue: number }[] = [
  { name: "Red", hue: 0 },
  { name: "Orange", hue: 25 },
  { name: "Amber", hue: 40 },
  { name: "Yellow", hue: 55 },
  { name: "Green", hue: 120 },
  { name: "Cyan", hue: 185 },
  { name: "Blue", hue: 230 },
  { name: "Purple", hue: 270 },
  { name: "Magenta", hue: 300 },
  { name: "Pink", hue: 330 },
];

/** A light's colour (linear RGB, luminance 1) as the camera records it at a white balance. */
export function cameraColorRgb(light: [number, number, number], wbK: number): [number, number, number] {
  const w = kelvinRgb(wbK);
  const o: [number, number, number] = [light[0] / w[0], light[1] / w[1], light[2] / w[2]];
  const y = luma(o) || 1;
  return [o[0] / y, o[1] / y, o[2] / y];
}

/**
 * A light's colour as the CAMERA records it at a white balance: tungsten is
 * orange on a daylight balance and neutral on a tungsten one. Luminance kept
 * at 1, so white balance changes colour and never exposure.
 */
export function cameraColor(lightK: number, wbK: number): [number, number, number] {
  const l = kelvinRgb(lightK);
  const w = kelvinRgb(wbK);
  const o: [number, number, number] = [l[0] / w[0], l[1] / w[1], l[2] / w[2]];
  const y = 0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2];
  return [o[0] / y, o[1] / y, o[2] / y];
}

/**
 * Light bouncing round the set, as one averaged level. A stage set is open on
 * the camera side and above, so most of the light leaves; `keep` is the share
 * that stays to bounce. Deliberately simple, and reported on its own line in
 * the meter so nobody mistakes it for something it is not.
 */
export function roomBounceLux(totalFlux: number, reflectance = 0.45, surfaceM2 = 110, keep = 0.35): number {
  if (!(totalFlux > 0)) return 0;
  return (totalFlux * reflectance * keep) / (surfaceM2 * (1 - reflectance));
}

export const WINDOW_SKIES = {
  overcast: { name: "Overcast", skyNits: 2500, sunLux: 0 },
  bright: { name: "Bright overcast", skyNits: 6000, sunLux: 0 },
  sun: { name: "Direct sun", skyNits: 7000, sunLux: 60000 },
} as const;
export type WindowSky = keyof typeof WINDOW_SKIES;

/**
 * One source read on its own, the way a gaffer meters a light with the others
 * off: what it reads, where it sits against the shot's own stop, and where it
 * sits against the key. Uses the SAME camera settings as the shot's meter, so
 * the light panel and the Exposure panel can never disagree about a number.
 */
export type SoloReading = {
  /** The stop this source alone calls for (no ND, like any meter). */
  reads: number;
  /** Stops over (+) or under (-) the shot's stop, ND included. */
  vsShot: number;
  /** The brightest source at the subject. */
  isKey: boolean;
  /** For anything but the key: stops against the key (negative = under). */
  vsKey: number | null;
  /** Key to this source (4 means 4:1). For the key, key to everything else. */
  ratio: number | null;
};

export function soloReading(
  lux: number, keyLux: number, totalLux: number, stop: number, iso: number, ndOptical = 0,
): SoloReading | null {
  if (!(lux > 0.5)) return null;
  const isKey = !(keyLux > lux + 1e-6);
  const rest = totalLux - lux;
  return {
    reads: readsAt(lux, iso),
    vsShot: stopsOver(lux, stop, iso, ndOptical),
    isKey,
    vsKey: isKey ? null : Math.log2(lux / keyLux),
    ratio: isKey ? (rest > 0.5 ? lux / rest : null) : keyLux / lux,
  };
}

/** "1 stop under", "0.7 stops over", "on" for a stop difference. */
export function stopsWord(s: number): string {
  if (!Number.isFinite(s)) return "no light";
  if (Math.abs(s) < 0.17) return "on";
  const r = Math.round(Math.abs(s) * 10) / 10;
  return `${r} ${r === 1 ? "stop" : "stops"} ${s > 0 ? "over" : "under"}`;
}
