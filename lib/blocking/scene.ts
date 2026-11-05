// Shot blocking: the scene model. A blocking scene is a low-poly set, the
// things in it, and ONE camera, each with keyframes on a shared timeline. It
// exists to make the motion reference an AI video model follows (Seedance
// copies the camera of a reference clip), so it is built for motion, not for
// lighting truth: that is the scene builder's job.
//
// Pure (no three.js, no "server-only"), so the trust boundary below and the
// keyframe engine in ./keys.ts can be tested in node.
//
// Conventions: metres, Y up, angles in degrees. An object faces its local +Z,
// so a car drives along +Z at yaw 0. A camera at yaw 0 looks down -Z (three's
// own convention), pitch up is positive, roll clockwise is positive.

export type Vec3 = [number, number, number];

/** How a key leaves toward the next one. */
export type Ease = "smooth" | "linear" | "in" | "out" | "hold";
export const EASES: { id: Ease; name: string; hint: string }[] = [
  { id: "smooth", name: "Smooth", hint: "Eases out of this key and into the next" },
  { id: "linear", name: "Linear", hint: "Constant speed to the next key" },
  { id: "in", name: "Ease in", hint: "Starts slow, arrives fast" },
  { id: "out", name: "Ease out", hint: "Leaves fast, settles into the next key" },
  { id: "hold", name: "Hold", hint: "Stays put, then jumps at the next key" },
];

/** A transform at a moment. `r` is yaw, pitch, roll. */
/**
 * `g` is a person's gesture at this key: [amount, lean]. Amount is 0 to 1, how
 * far into the gesture the person is (0 is the pose's own arms, 1 the gesture
 * done); lean is degrees, back positive. Absent means 0, 0. `gk` is which
 * gesture (GESTURES); absent means "reach", what every key written before the
 * menu existed was.
 */
export type Key = { t: number; p: Vec3; r: Vec3; ease: Ease; g?: [number, number]; gk?: GestureKind };

/** What a person can do with their arms. `target`: whether it is done toward an object. */
export const GESTURES = [
  { id: "reach", name: "Reach and touch", hint: "A hand goes to an object and rests on it, or strokes it", target: "required", hands: 1 },
  { id: "point", name: "Point", hint: "Points at an object, or straight ahead", target: "optional", hands: 1 },
  { id: "offer", name: "Hold out", hint: "Holds a hand out, as if handing something over", target: "optional", hands: 1 },
  { id: "wave", name: "Wave", hint: "A hand up beside the head, waving", target: "none", hands: 1 },
  { id: "raise", name: "Raise a hand", hint: "A hand straight up, a question or a taxi", target: "none", hands: 1 },
  { id: "phone", name: "On the phone", hint: "A hand at the ear", target: "none", hands: 1 },
  { id: "drink", name: "Drink or eat", hint: "A hand at the mouth", target: "none", hands: 1 },
  { id: "chin", name: "Hand to chin", hint: "Thinking it over", target: "none", hands: 1 },
  { id: "present", name: "Show with both hands", hint: "Holds something up in front, to the camera", target: "none", hands: 2 },
  { id: "cheer", name: "Arms up", hint: "Both arms up, celebrating", target: "none", hands: 2 },
  { id: "open", name: "Open arms", hint: "Arms out wide, a welcome or a hug", target: "none", hands: 2 },
  { id: "shrug", name: "Shrug", hint: "Hands out, palms up", target: "none", hands: 2 },
  { id: "hips", name: "Hands on hips", hint: "Both hands on the hips", target: "none", hands: 2 },
  { id: "clap", name: "Clap", hint: "Clapping in front of the chest", target: "none", hands: 2 },
  { id: "cover", name: "Hands to face", hint: "Surprise, or laughing behind the hands", target: "none", hands: 2 },
] as const;
export type GestureKind = (typeof GESTURES)[number]["id"];
export const gestureOf = (id: string | undefined) => GESTURES.find((g) => g.id === id) ?? GESTURES[0];
/**
 * A camera key also carries the lens, and `af`: how far the subject sits off
 * centre at this key while the camera is kept aimed (yaw, pitch degrees). It
 * lives on the key, not the shot, so reframing one key leaves the others alone.
 */
/**
 * `tan` is a curve handle: where the path heads as it leaves this key, as an
 * offset in metres from the key in the camera's parent frame (the path also
 * arrives along the mirror of it, so speed stays continuous). Absent means
 * automatic, the curve the neighbouring keys imply. Used by the continuous
 * and even flows; Stop at keys ignores it.
 */
export type CamKey = Key & { lens: number; af?: [number, number]; tan?: Vec3 };

export type BlockObject = {
  id: string;
  kind: string;
  name: string;
  color: string;
  /** Width, height, depth. */
  size: Vec3;
  keys: Key[];
  /** People and animals: the pose drawn. */
  pose?: string;
  /** Rides along with another object (a passenger in a car). */
  parent?: string | null;
  hidden?: boolean;
  /** Vehicles: which seating layout is drawn (an SUV with two or three rows). */
  seats?: string;
  /**
   * People: what a gesture is done toward (another object's id: a dog's head,
   * a product, a person), with which hand, and whether a reach strokes once
   * there. Which gesture, and how far into it, is keyed (Key.gk, Key.g).
   */
  reach?: Reach;
  /** People: body shape and hair, so a figure reads as a particular person. */
  build?: BodyBuild;
  hair?: HairStyle;
};

export const BODY_BUILDS = [
  { id: "slim", name: "Slim" }, { id: "average", name: "Average" }, { id: "broad", name: "Broad" }, { id: "curvy", name: "Curvy" },
] as const;
export type BodyBuild = (typeof BODY_BUILDS)[number]["id"];
export const HAIR_STYLES = [
  { id: "short", name: "Short" }, { id: "long", name: "Long" }, { id: "bun", name: "Tied up" },
  { id: "curly", name: "Curly" }, { id: "bald", name: "None" },
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number]["id"];

export type Reach = { target: string | null; hand: "right" | "left"; stroke: boolean };
export const LEAN_MIN = -25;
export const LEAN_MAX = 45;

export type Shake = { amount: number; speed: number };

export type BlockCamera = {
  body: string;
  keys: CamKey[];
  /** Keys are relative to this object, so the camera rides along with it. */
  parent: string | null;
  shake: Shake;
  /** Smooth curves through the keys, or straight lines between them. */
  path: "smooth" | "linear";
  /**
   * How the camera moves through its keys. "keys": each key eases in and out
   * on its own, so the camera settles at every one. "continuous": it flows
   * through every key at that key's time without stopping. "even": one
   * steady speed along the whole path (keys set the route, not the timing).
   */
  flow: CameraFlow;
  /** With continuous or even: start from rest and come to rest at the ends. */
  easeEnds: boolean;
  /**
   * Keep the camera pointed at an object, whatever the keys say, like a
   * Track To constraint. `frame` nudges the subject off centre (yaw, pitch
   * degrees); the keys' roll still applies.
   */
  aim: { target: string | null; frame: [number, number] };
};

export type CameraFlow = "keys" | "continuous" | "even";
export const CAMERA_FLOWS: { id: CameraFlow; name: string; hint: string }[] = [
  { id: "continuous", name: "Continuous", hint: "Flows through every key at its time without stopping" },
  { id: "even", name: "Even speed", hint: "One steady speed along the whole path; the keys set the route" },
  { id: "keys", name: "Stop at keys", hint: "Each key eases in and out on its own, so the camera settles at every one" },
];

export type Environment = {
  sky: string;
  ground: "grass" | "asphalt" | "sand" | "dirt" | "snow" | "studio" | "water" | "none";
  /** 0 to 1: how much distance fades into the sky. */
  haze: number;
  /** Where the sun comes from, degrees round and up. */
  sunAz: number;
  sunEl: number;
};

export type Look = "blockout" | "clay" | "lit";
export const LOOKS: { id: Look; name: string; hint: string }[] = [
  { id: "blockout", name: "Blockout", hint: "Flat colour per object: what Seedance reads best" },
  { id: "clay", name: "Clay", hint: "Warm white clay, softly shaded: the look of a 3D previz" },
  { id: "lit", name: "Lit", hint: "Colour with sun and shadows" },
];

export type BlockScene = {
  v: 1;
  name: string;
  fps: 24 | 25 | 30;
  /** Seconds. */
  duration: number;
  aspect: string;
  look: Look;
  environment: Environment;
  objects: BlockObject[];
  camera: BlockCamera;
};

export const FPS: (24 | 25 | 30)[] = [24, 25, 30];
export const MAX_DURATION = 30;
export const MIN_DURATION = 1;

/** The frame shapes a generated clip is made in. */
export const BLOCK_ASPECTS: { id: string; label: string; ratio: number }[] = [
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "21:9", label: "21:9", ratio: 21 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
];
export const aspectRatio = (id: string) => BLOCK_ASPECTS.find((a) => a.id === id)?.ratio ?? 16 / 9;

/* ---------- the catalogue ---------- */

export type BlockCategory = "people" | "vehicles" | "environment" | "nature" | "buildings" | "street" | "set" | "shapes";
export const BLOCK_CATEGORIES: { id: BlockCategory; name: string }[] = [
  { id: "people", name: "People and animals" },
  { id: "vehicles", name: "Vehicles" },
  { id: "environment", name: "Ground and landscape" },
  { id: "nature", name: "Trees and plants" },
  { id: "buildings", name: "Buildings and walls" },
  { id: "street", name: "Street" },
  { id: "set", name: "Indoors" },
  { id: "shapes", name: "Shapes" },
];

export type BlockKind = {
  kind: string;
  name: string;
  category: BlockCategory;
  size: Vec3;
  color: string;
  hint: string;
  /** Sits on the ground by default (y = 0). Water and sky pieces do not. */
  poses?: string[];
  /** Vehicles with a choice of seating, first is the default. */
  seats?: { id: string; name: string }[];
};

const FT = 0.3048;
export const BLOCK_KINDS: BlockKind[] = [
  { kind: "person", name: "Person", category: "people", size: [0.5, 1.75, 0.3], color: "#d98aa8", hint: "Any pose, true proportions", poses: ["standing", "walking", "seated", "pointing", "arms-crossed", "kneeling"] },
  { kind: "child", name: "Child", category: "people", size: [0.35, 1.2, 0.22], color: "#e3b26b", hint: "About eight years old", poses: ["standing", "walking", "seated", "pointing", "arms-crossed", "kneeling"] },
  { kind: "dog", name: "Dog", category: "people", size: [0.32, 0.7, 0.95], color: "#b99a72", hint: "A large dog, sitting or standing", poses: ["standing", "seated"] },
  { kind: "car", name: "Car", category: "vehicles", size: [1.85, 1.45, 4.7], color: "#e7e5df", hint: "A sedan, open cabin with seats" },
  { kind: "suv", name: "SUV", category: "vehicles", size: [2.0, 1.85, 5.1], color: "#e7e5df", hint: "Two rows and a cargo area, or three rows", seats: [{ id: "two", name: "Two rows + cargo" }, { id: "three", name: "Three rows" }] },
  { kind: "van", name: "Van", category: "vehicles", size: [2.05, 2.3, 5.6], color: "#d7d3ca", hint: "A panel van" },
  { kind: "truck", name: "Pickup", category: "vehicles", size: [2.05, 1.95, 5.9], color: "#9aa7b4", hint: "A pickup with an open bed" },
  { kind: "bike", name: "Motorbike", category: "vehicles", size: [0.8, 1.15, 2.1], color: "#3a3d44", hint: "With or without a rider" },
  { kind: "road", name: "Road", category: "environment", size: [8, 0.02, 200], color: "#3b3d42", hint: "Two lanes with a centre line" },
  { kind: "sidewalk", name: "Sidewalk", category: "environment", size: [3, 0.12, 40], color: "#a9a59d", hint: "Paving slabs with a kerb" },
  { kind: "crosswalk", name: "Crosswalk", category: "environment", size: [8, 0.03, 3.5], color: "#3b3d42", hint: "Zebra stripes, lay it over a road" },
  { kind: "parking", name: "Parking lot", category: "environment", size: [24, 0.02, 16], color: "#45474c", hint: "Asphalt with marked bays" },
  { kind: "lawn", name: "Lawn", category: "environment", size: [12, 0.03, 12], color: "#7c9a52", hint: "A patch of grass" },
  { kind: "path", name: "Dirt path", category: "environment", size: [1.6, 0.03, 30], color: "#9b8463", hint: "A footpath through a park or a field" },
  { kind: "pond", name: "Pond", category: "environment", size: [9, 0.04, 6], color: "#4a7d98", hint: "Still water" },
  { kind: "hill", name: "Hill", category: "environment", size: [60, 14, 60], color: "#7d8a58", hint: "A low-poly rise" },
  { kind: "mountain", name: "Mountain", category: "environment", size: [160, 70, 160], color: "#6f7764", hint: "Far away, on the horizon" },
  { kind: "sea", name: "Sea", category: "environment", size: [600, 0.02, 600], color: "#4a7d98", hint: "Water to the horizon" },
  { kind: "tree", name: "Tree", category: "nature", size: [4, 8, 4], color: "#5d7a4a", hint: "Trunk and a pointed canopy" },
  { kind: "oak", name: "Leafy tree", category: "nature", size: [6, 7, 6], color: "#6a8a4c", hint: "A broad, rounded canopy" },
  { kind: "pine", name: "Pine", category: "nature", size: [3, 10, 3], color: "#45633f", hint: "A tall conifer" },
  { kind: "palm", name: "Palm tree", category: "nature", size: [4, 9, 4], color: "#6c8c46", hint: "A curved trunk and fronds" },
  { kind: "bush", name: "Bush", category: "nature", size: [1.6, 1.1, 1.6], color: "#62844a", hint: "A rounded shrub" },
  { kind: "hedge", name: "Hedge", category: "nature", size: [4, 1.3, 0.9], color: "#557a43", hint: "A clipped row" },
  { kind: "flowers", name: "Flower bed", category: "nature", size: [2.4, 0.45, 1.2], color: "#d9789a", hint: "Soil and blooms" },
  { kind: "grass", name: "Tall grass", category: "nature", size: [1.4, 0.8, 1.4], color: "#8aa059", hint: "A clump of reeds or grass" },
  { kind: "cactus", name: "Cactus", category: "nature", size: [1.2, 3, 0.6], color: "#5f8a52", hint: "A saguaro, for the desert" },
  { kind: "rock", name: "Rock", category: "nature", size: [2.4, 1.6, 2.0], color: "#8b867d", hint: "A boulder" },
  { kind: "log", name: "Log", category: "nature", size: [0.5, 0.5, 3], color: "#7a5f45", hint: "A fallen trunk" },
  { kind: "building", name: "Office block", category: "buildings", size: [12, 18, 12], color: "#b7aea2", hint: "A block with window rows" },
  { kind: "skyscraper", name: "Tower", category: "buildings", size: [20, 80, 20], color: "#8fa0b0", hint: "A glass high-rise" },
  { kind: "house", name: "House", category: "buildings", size: [8, 7, 9], color: "#d6c7ae", hint: "Pitched roof, front door, windows" },
  { kind: "shopfront", name: "Shop front", category: "buildings", size: [8, 4.5, 6], color: "#c9b8a0", hint: "A glass front with an awning" },
  { kind: "garage", name: "Garage", category: "buildings", size: [4, 3, 6.5], color: "#c4beb4", hint: "A roller door" },
  { kind: "warehouse", name: "Warehouse", category: "buildings", size: [30, 9, 20], color: "#a7a9a6", hint: "A big shed with loading doors" },
  { kind: "fence", name: "Picket fence", category: "buildings", size: [6, 1.1, 0.08], color: "#ece8de", hint: "A garden fence" },
  { kind: "lowwall", name: "Garden wall", category: "buildings", size: [6, 1, 0.3], color: "#b9a58c", hint: "Low brick or stone" },
  { kind: "lamppost", name: "Street light", category: "street", size: [0.3, 6, 1.2], color: "#55585e", hint: "A pole with an arm" },
  { kind: "trafficlight", name: "Traffic light", category: "street", size: [0.4, 4, 0.4], color: "#3d4046", hint: "Red, amber, green" },
  { kind: "stopsign", name: "Stop sign", category: "street", size: [0.75, 2.4, 0.1], color: "#c94b42", hint: "An octagon on a post" },
  { kind: "sign", name: "Street sign", category: "street", size: [0.9, 2.8, 0.1], color: "#3d7a5c", hint: "A name plate on a post" },
  { kind: "busstop", name: "Bus stop", category: "street", size: [3.6, 2.6, 1.5], color: "#8d9aa6", hint: "A shelter with a bench" },
  { kind: "bench", name: "Bench", category: "street", size: [1.8, 0.85, 0.65], color: "#8a6a4d", hint: "Park or street seating" },
  { kind: "bin", name: "Trash can", category: "street", size: [0.55, 0.95, 0.55], color: "#4d5a52", hint: "A litter bin" },
  { kind: "dumpster", name: "Dumpster", category: "street", size: [2, 1.4, 1.2], color: "#4c6d58", hint: "An alley skip" },
  { kind: "hydrant", name: "Fire hydrant", category: "street", size: [0.4, 0.8, 0.4], color: "#c9473f", hint: "On the kerb" },
  { kind: "mailbox", name: "Mailbox", category: "street", size: [0.55, 1.25, 0.5], color: "#3f5e9c", hint: "A collection box" },
  { kind: "bollard", name: "Bollard", category: "street", size: [0.25, 1, 0.25], color: "#5a5d63", hint: "A short post" },
  { kind: "meter", name: "Parking meter", category: "street", size: [0.25, 1.4, 0.25], color: "#5a5d63", hint: "On the kerb" },
  { kind: "cone", name: "Traffic cone", category: "street", size: [0.4, 0.7, 0.4], color: "#e07f3a", hint: "Road works" },
  { kind: "barrier", name: "Barrier", category: "street", size: [2, 1, 0.5], color: "#e0d36a", hint: "A striped road barrier" },
  { kind: "pole", name: "Utility pole", category: "street", size: [2.2, 10, 0.35], color: "#7a6a58", hint: "Power or phone lines" },
  { kind: "billboard", name: "Billboard", category: "street", size: [10, 9, 0.6], color: "#d8d5ce", hint: "A big board on legs" },
  { kind: "bicycle", name: "Bicycle", category: "street", size: [0.6, 1.05, 1.75], color: "#3f6fa3", hint: "Parked or ridden" },
  { kind: "picnic", name: "Picnic table", category: "street", size: [1.8, 0.75, 1.6], color: "#9a7a55", hint: "A table with bench seats" },
  { kind: "parasol", name: "Café table", category: "street", size: [2.4, 2.4, 2.4], color: "#d7c8a8", hint: "A table under an umbrella" },
  { kind: "planter", name: "Planter", category: "street", size: [1.2, 1.1, 1.2], color: "#9c8a74", hint: "A box with a shrub" },
  { kind: "fountain", name: "Fountain", category: "street", size: [4, 2, 4], color: "#b9b6ae", hint: "A basin with a spout" },
  { kind: "vending", name: "Vending machine", category: "street", size: [1, 1.85, 0.8], color: "#c25b4a", hint: "Drinks and snacks" },
  { kind: "wall", name: "Wall", category: "set", size: [6, 2.8, 0.15], color: "#d8d1c4", hint: "A section of wall" },
  { kind: "window", name: "Window wall", category: "set", size: [3, 2.8, 0.15], color: "#d8d1c4", hint: "A wall with a window in it" },
  { kind: "room", name: "Room", category: "set", size: [5, 2.8, 6], color: "#d8d1c4", hint: "Four walls, open on top" },
  { kind: "door", name: "Doorway", category: "set", size: [1.2, 2.4, 0.15], color: "#d8d1c4", hint: "A wall with a door opening" },
  { kind: "stairs", name: "Stairs", category: "set", size: [1.2, 1.8, 3], color: "#bdb5a8", hint: "A straight flight" },
  { kind: "table", name: "Table", category: "set", size: [1.6, 0.75, 0.9], color: "#8a6a4d", hint: "A dining table" },
  { kind: "coffeetable", name: "Coffee table", category: "set", size: [1.1, 0.42, 0.6], color: "#8a6a4d", hint: "Low, in front of a sofa" },
  { kind: "desk", name: "Desk", category: "set", size: [1.4, 0.75, 0.7], color: "#a08060", hint: "With a drawer unit" },
  { kind: "chair", name: "Chair", category: "set", size: [0.46, 0.9, 0.5], color: "#8a6a4d", hint: "A dining or desk chair" },
  { kind: "stool", name: "Bar stool", category: "set", size: [0.4, 0.75, 0.4], color: "#55585e", hint: "For a counter or a bar" },
  { kind: "sofa", name: "Sofa", category: "set", size: [2.1, 0.85, 0.92], color: "#8b8f97", hint: "Three seater" },
  { kind: "armchair", name: "Armchair", category: "set", size: [0.95, 0.85, 0.9], color: "#9a8f86", hint: "One seat" },
  { kind: "bed", name: "Bed", category: "set", size: [1.6, 0.55, 2.1], color: "#e9e6df", hint: "Queen" },
  { kind: "counter", name: "Counter", category: "set", size: [2.4, 0.9, 0.62], color: "#cfc8bb", hint: "Kitchen worktop" },
  { kind: "fridge", name: "Fridge", category: "set", size: [0.8, 1.8, 0.75], color: "#dcdcd8", hint: "A tall refrigerator" },
  { kind: "cabinet", name: "Dresser", category: "set", size: [1.2, 0.85, 0.5], color: "#8f7458", hint: "A chest of drawers" },
  { kind: "bookshelf", name: "Bookshelf", category: "set", size: [1, 1.9, 0.35], color: "#8f7458", hint: "Shelves of books" },
  { kind: "tv", name: "TV on a stand", category: "set", size: [1.6, 1.25, 0.45], color: "#3a3d44", hint: "A screen on a media unit" },
  { kind: "lamp", name: "Floor lamp", category: "set", size: [0.45, 1.6, 0.45], color: "#d8cfb8", hint: "A pole with a shade" },
  { kind: "plant", name: "Potted plant", category: "set", size: [0.5, 1.1, 0.5], color: "#62844a", hint: "A pot with leaves" },
  { kind: "rug", name: "Rug", category: "set", size: [2.4, 0.01, 1.7], color: "#a86d5b", hint: "On the floor" },
  { kind: "product", name: "Product", category: "set", size: [0.08, 0.26, 0.08], color: "#4fb3a3", hint: "A bottle-sized hero product" },
  { kind: "box", name: "Box", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "Stands in for anything" },
  { kind: "cylinder", name: "Cylinder", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "A column or a can" },
  { kind: "sphere", name: "Sphere", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "A ball or a head" },
  { kind: "ramp", name: "Ramp", category: "shapes", size: [2, 1, 3], color: "#c9c3b8", hint: "A wedge" },
  { kind: "target", name: "Target", category: "shapes", size: [0.4, 0.4, 0.4], color: "#f2c14e", hint: "An invisible point to aim the camera at" },
];
export const blockKind = (kind: string): BlockKind => BLOCK_KINDS.find((k) => k.kind === kind) ?? BLOCK_KINDS.find((k) => k.kind === "box")!;

/** Colours a blockout cycles through, so neighbouring subjects read apart. */
export const SUBJECT_COLORS = ["#d98aa8", "#6f9bd8", "#e3b26b", "#8cc27a", "#b48ad9", "#e07f5f", "#5fc0c0", "#d9d36a"];

let seq = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function newObject(kind: string, p: Vec3 = [0, 0, 0], yaw = 0, used: BlockObject[] = []): BlockObject {
  const k = blockKind(kind);
  // People get the next subject colour that is not already on the set, so two
  // people never arrive in the same colour.
  let color = k.color;
  if (k.category === "people" && kind !== "dog") {
    const taken = new Set(used.map((o) => o.color));
    color = SUBJECT_COLORS.find((c) => !taken.has(c)) ?? k.color;
  }
  const count = used.filter((o) => o.kind === kind).length;
  return {
    id: newId("o"),
    kind,
    name: count ? `${k.name} ${count + 1}` : k.name,
    color,
    size: [...k.size] as Vec3,
    keys: [{ t: 0, p, r: [yaw, 0, 0], ease: "smooth" }],
    pose: k.poses?.[0],
    seats: k.seats?.[0].id,
    parent: null,
  };
}

export const DEFAULT_ENV: Environment = { sky: "#b9cde0", ground: "grass", haze: 0.35, sunAz: 140, sunEl: 40 };

export function blankScene(name = "Untitled blocking"): BlockScene {
  return {
    v: 1,
    name,
    fps: 24,
    duration: 8,
    aspect: "16:9",
    look: "blockout",
    environment: { ...DEFAULT_ENV, ground: "studio", sky: "#9fa4ab", haze: 0.15 },
    objects: [],
    camera: {
      body: "alexamini",
      keys: [{ t: 0, p: [0, 1.6, 6], r: [0, -4, 0], lens: 35, ease: "smooth" }],
      parent: null,
      shake: { amount: 0, speed: 1 },
      path: "smooth",
      flow: "continuous",
      easeEnds: true,
      aim: { target: null, frame: [0, 0] },
    },
  };
}

/* ---------- the trust boundary ---------- */

const num = (v: unknown, d: number, lo = -1e5, hi = 1e5) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const vec = (v: unknown, d: Vec3, lo?: number, hi?: number): Vec3 =>
  Array.isArray(v) ? [num(v[0], d[0], lo, hi), num(v[1], d[1], lo, hi), num(v[2], d[2], lo, hi)] : d;
const str = (v: unknown, d: string, max = 120) => (typeof v === "string" ? v.slice(0, max) : d);
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const ease = (v: unknown): Ease => (EASES.some((e) => e.id === v) ? (v as Ease) : "smooth");

function reachOf(r: Record<string, unknown>): Reach {
  return { target: typeof r.target === "string" ? r.target.slice(0, 60) : null, hand: r.hand === "left" ? "left" : "right", stroke: r.stroke === true };
}

function keyOf(raw: unknown, duration: number): Key | null {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as Record<string, unknown>;
  const out: Key = { t: num(k.t, 0, 0, duration), p: vec(k.p, [0, 0, 0]), r: vec(k.r, [0, 0, 0], -36000, 36000), ease: ease(k.ease) };
  if (Array.isArray(k.g)) {
    const g: [number, number] = [num(k.g[0], 0, 0, 1), num(k.g[1], 0, LEAN_MIN, LEAN_MAX)];
    if (g[0] > 0 || g[1] !== 0) out.g = g;
  }
  if (typeof k.gk === "string" && k.gk !== "reach" && GESTURES.some((x) => x.id === k.gk)) out.gk = k.gk as GestureKind;
  return out;
}

/** Keys in time order, one per frame at most (a later duplicate wins). */
export function tidyKeys<T extends Key>(keys: T[], fps: number): T[] {
  const half = 0.5 / fps;
  const out: T[] = [];
  for (const k of [...keys].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && k.t - last.t < half) out[out.length - 1] = k;
    else out.push(k);
  }
  return out;
}

const MAX_OBJECTS = 300;
const MAX_KEYS = 400;

/** Reads a stored or uploaded scene. Anything unreadable becomes null. */
export function asBlockScene(raw: unknown): BlockScene | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.v !== 1) return null;
  const fps = FPS.includes(s.fps as 24) ? (s.fps as 24 | 25 | 30) : 24;
  const duration = num(s.duration, 8, MIN_DURATION, MAX_DURATION);
  const envRaw = (s.environment ?? {}) as Record<string, unknown>;
  const grounds: Environment["ground"][] = ["grass", "asphalt", "sand", "dirt", "snow", "studio", "water", "none"];
  const environment: Environment = {
    sky: hex(envRaw.sky, DEFAULT_ENV.sky),
    ground: grounds.includes(envRaw.ground as "grass") ? (envRaw.ground as Environment["ground"]) : "grass",
    haze: num(envRaw.haze, DEFAULT_ENV.haze, 0, 1),
    sunAz: num(envRaw.sunAz, DEFAULT_ENV.sunAz, -360, 360),
    sunEl: num(envRaw.sunEl, DEFAULT_ENV.sunEl, 2, 90),
  };
  const ids = new Set<string>();
  const objects: BlockObject[] = [];
  for (const o of Array.isArray(s.objects) ? s.objects.slice(0, MAX_OBJECTS) : []) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const id = str(r.id, "", 60);
    if (!id || ids.has(id)) continue;
    const kind = BLOCK_KINDS.some((k) => k.kind === r.kind) ? (r.kind as string) : "box";
    const keys = tidyKeys(
      (Array.isArray(r.keys) ? r.keys.slice(0, MAX_KEYS) : []).map((k) => keyOf(k, duration)).filter((k): k is Key => !!k),
      fps,
    );
    if (!keys.length) continue;
    ids.add(id);
    const bk = blockKind(kind);
    objects.push({
      id,
      kind,
      name: str(r.name, bk.name).trim() || bk.name,
      color: hex(r.color, bk.color),
      size: vec(r.size, bk.size, 0.01, 2000),
      keys,
      pose: bk.poses ? (bk.poses.includes(r.pose as string) ? (r.pose as string) : bk.poses[0]) : undefined,
      seats: bk.seats ? (bk.seats.some((x) => x.id === r.seats) ? (r.seats as string) : bk.seats[0].id) : undefined,
      build: (kind === "person" || kind === "child") && BODY_BUILDS.some((x) => x.id === r.build) ? (r.build as BodyBuild) : undefined,
      hair: (kind === "person" || kind === "child") && HAIR_STYLES.some((x) => x.id === r.hair) ? (r.hair as HairStyle) : undefined,
      parent: typeof r.parent === "string" ? r.parent : null,
      hidden: r.hidden === true,
      reach: (kind === "person" || kind === "child") && r.reach && typeof r.reach === "object" ? reachOf(r.reach as Record<string, unknown>) : undefined,
    });
  }
  // A parent must exist and must not lead back round to the object itself.
  const byId = new Map(objects.map((o) => [o.id, o]));
  for (const o of objects) {
    let p = o.parent ? byId.get(o.parent) : undefined;
    const seen = new Set([o.id]);
    while (p && !seen.has(p.id)) { seen.add(p.id); p = p.parent ? byId.get(p.parent) : undefined; }
    if (!o.parent || !byId.has(o.parent) || p) o.parent = null;
    if (o.reach?.target && (o.reach.target === o.id || !byId.has(o.reach.target))) o.reach = { ...o.reach, target: null };
  }

  const camRaw = (s.camera ?? {}) as Record<string, unknown>;
  const camKeys = tidyKeys(
    (Array.isArray(camRaw.keys) ? camRaw.keys.slice(0, MAX_KEYS) : [])
      .map((k) => {
        const base = keyOf(k, duration);
        if (!base) return null;
        const kr = k as Record<string, unknown>;
        const af = Array.isArray(kr.af) ? [num(kr.af[0], 0, -60, 60), num(kr.af[1], 0, -40, 40)] as [number, number] : undefined;
        const tan = Array.isArray(kr.tan) && kr.tan.length === 3 && kr.tan.every((x) => Number.isFinite(Number(x)))
          ? kr.tan.map((x) => Math.max(-200, Math.min(200, Number(x)))) as Vec3 : undefined;
        return { ...base, lens: num(kr.lens, 35, 8, 600), ...(af && (af[0] || af[1]) ? { af } : {}), ...(tan ? { tan } : {}) } as CamKey;
      })
      .filter((k): k is CamKey => !!k),
    fps,
  );
  const shakeRaw = (camRaw.shake ?? {}) as Record<string, unknown>;
  const camera: BlockCamera = {
    body: str(camRaw.body, "alexamini", 40),
    keys: camKeys.length ? camKeys : blankScene().camera.keys,
    parent: typeof camRaw.parent === "string" && byId.has(camRaw.parent) ? camRaw.parent : null,
    shake: { amount: num(shakeRaw.amount, 0, 0, 1), speed: num(shakeRaw.speed, 1, 0.1, 4) },
    path: camRaw.path === "linear" ? "linear" : "smooth",
    // Older scenes carry no flow: they get the continuous move, which is what
    // a camera path is almost always meant to be.
    flow: camRaw.flow === "keys" || camRaw.flow === "even" ? camRaw.flow : "continuous",
    easeEnds: camRaw.easeEnds !== false,
    aim: (() => {
      const a = (camRaw.aim ?? {}) as Record<string, unknown>;
      const fr = Array.isArray(a.frame) ? a.frame : [];
      return {
        target: typeof a.target === "string" && byId.has(a.target) ? a.target : null,
        frame: [num(fr[0], 0, -60, 60), num(fr[1], 0, -40, 40)] as [number, number],
      };
    })(),
  };
  // Framing used to be one offset for the whole shot. A scene saved that way
  // carries it onto every key, so it looks the same and each key can then be
  // reframed on its own.
  const [gy, gp] = camera.aim.frame;
  if (gy || gp) {
    camera.keys = camera.keys.map((k) => (k.af ? k : { ...k, af: [gy, gp] as [number, number] }));
    camera.aim = { ...camera.aim, frame: [0, 0] };
  }
  return {
    v: 1,
    name: str(s.name, "Untitled blocking").trim() || "Untitled blocking",
    fps,
    duration,
    aspect: BLOCK_ASPECTS.some((a) => a.id === s.aspect) ? (s.aspect as string) : "16:9",
    look: LOOKS.some((l) => l.id === s.look) ? (s.look as Look) : "blockout",
    environment,
    objects,
    camera,
  };
}

export { FT };
