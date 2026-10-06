// Poses for the Scene Setup figures. A pose is data: where each joint sits,
// as fractions of the person's height, so one table serves a 5'2" and a 6'4"
// performer alike. Pure (no three.js), so it can be tested on its own.
//
// Frame: the figure stands at the origin facing +Z. Its RIGHT side is -X
// (facing +Z, the right hand is on the -X side), its left side is +X.

export type PoseId =
  | "standing" | "walking" | "arms-crossed" | "hand-on-hip"
  | "holding" | "pointing" | "seated" | "kneeling";

/** A point as fractions of height: [x, y, z]. */
type P = [number, number, number];

export type PoseDef = {
  id: PoseId;
  name: string;
  /** Hip height as a fraction of height (a seat height in metres when seated). */
  hip: number;
  seatM?: number;
  /** Per side: index 0 is the figure's right (-X), 1 its left (+X). */
  knee: [P, P];
  ankle: [P, P];
  elbow: [P, P];
  wrist: [P, P];
  /** Forward lean of the torso, degrees. */
  lean?: number;
};

// Shoulder sits at hip + 0.29, head at hip + 0.395 (both fractions of height).
const SH = 0.29;

const STANDING: PoseDef = {
  id: "standing", name: "Standing", hip: 0.52,
  knee: [[-0.055, 0.27, 0.01], [0.055, 0.27, 0.01]],
  ankle: [[-0.055, 0.04, 0], [0.055, 0.04, 0]],
  elbow: [[-0.15, -0.18, 0], [0.15, -0.18, 0]],
  wrist: [[-0.155, -0.34, 0.02], [0.155, -0.34, 0.02]],
};

/**
 * Elbows and wrists are given RELATIVE TO THE SHOULDER LINE (their y is an
 * offset from shoulder height), since a raised arm is about the shoulder, not
 * the floor. Knees and ankles are absolute heights.
 */
export const POSES: PoseDef[] = [
  STANDING,
  {
    id: "walking", name: "Walking", hip: 0.51,
    knee: [[-0.055, 0.27, 0.07], [0.055, 0.27, -0.03]],
    ankle: [[-0.055, 0.04, 0.13], [0.055, 0.07, -0.13]],
    elbow: [[-0.15, -0.17, -0.06], [0.15, -0.17, 0.06]],
    wrist: [[-0.15, -0.32, -0.08], [0.15, -0.31, 0.12]],
  },
  {
    id: "arms-crossed", name: "Arms crossed", hip: 0.52,
    knee: STANDING.knee, ankle: STANDING.ankle,
    elbow: [[-0.15, -0.16, 0.05], [0.15, -0.16, 0.05]],
    wrist: [[0.07, -0.12, 0.11], [-0.07, -0.1, 0.11]],
  },
  {
    id: "hand-on-hip", name: "Hand on hip", hip: 0.52,
    knee: STANDING.knee, ankle: STANDING.ankle,
    elbow: [[-0.15, -0.18, 0], [0.24, -0.15, -0.02]],
    wrist: [[-0.155, -0.34, 0.02], [0.12, -0.29, 0.02]],
  },
  {
    // The product is held in the right hand at chest height, label to camera.
    id: "holding", name: "Holding product", hip: 0.52,
    knee: STANDING.knee, ankle: STANDING.ankle,
    elbow: [[-0.15, -0.17, 0.03], [0.15, -0.18, 0]],
    wrist: [[-0.08, -0.1, 0.17], [0.155, -0.34, 0.02]],
  },
  {
    id: "pointing", name: "Pointing", hip: 0.52,
    knee: STANDING.knee, ankle: STANDING.ankle,
    elbow: [[-0.15, -0.02, 0.15], [0.15, -0.18, 0]],
    wrist: [[-0.15, 0.0, 0.31], [0.155, -0.34, 0.02]],
  },
  {
    id: "seated", name: "Seated", hip: 0.47, seatM: 0.47,
    knee: [[-0.055, 0.27, 0.25], [0.055, 0.27, 0.25]],
    ankle: [[-0.055, 0.04, 0.27], [0.055, 0.04, 0.27]],
    elbow: [[-0.15, -0.17, 0.05], [0.15, -0.17, 0.05]],
    wrist: [[-0.1, -0.18, 0.2], [0.1, -0.18, 0.2]],
  },
  {
    // On one knee: the right knee down, the left foot planted forward.
    id: "kneeling", name: "Kneeling", hip: 0.3,
    knee: [[-0.055, 0.03, -0.02], [0.055, 0.17, 0.2]],
    ankle: [[-0.055, 0.04, -0.27], [0.055, 0.04, 0.2]],
    elbow: [[-0.15, -0.18, 0.02], [0.15, -0.15, 0.08]],
    wrist: [[-0.155, -0.33, 0.04], [0.12, -0.18, 0.2]],
  },
];

export function poseDef(id: string | undefined): PoseDef {
  return POSES.find((p) => p.id === id) ?? STANDING;
}

/**
 * Hip height in metres. A seated person's hip is the SEAT, whatever their
 * height: the top of what they sit on when there is something (a bed, a sofa),
 * else an implied chair at seatM.
 */
export function hipY(pose: PoseDef, heightM: number, seatY?: number | null): number {
  // The hip joint is the middle of the thigh, so it sits a thigh's radius
  // above what they sit on, or they sink into it.
  if (pose.seatM !== undefined) return seatY != null ? seatY + 0.034 * heightM : pose.seatM;
  return pose.hip * heightM;
}
export function shoulderY(pose: PoseDef, heightM: number, seatY?: number | null): number {
  return hipY(pose, heightM, seatY) + SH * heightM;
}
/** Eye line, where "focus on" pulls to. */
export function eyeY(pose: PoseDef, heightM: number, seatY?: number | null): number {
  return shoulderY(pose, heightM, seatY) + 0.11 * heightM;
}

/** Knee to ankle, as a fraction of height. */
export const SHIN = 0.235;

/**
 * The right hand's position in the figure's own frame, metres. The held
 * product goes here.
 */
export function rightHand(pose: PoseDef, heightM: number, seatY?: number | null): [number, number, number] {
  const w = pose.wrist[0];
  return [w[0] * heightM, shoulderY(pose, heightM, seatY) + w[1] * heightM, w[2] * heightM];
}
