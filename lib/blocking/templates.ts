// Shot blocking: starting scenes. Each is a set, its subjects and a camera
// move already keyed, so a new scene opens playing something rather than on
// an empty floor. Everything in them is ordinary: it moves, re-times and
// deletes like anything added by hand.
import { aimAt, presetKeys } from "./keys";
import { blankScene, newObject, type BlockObject, type BlockScene, type CamKey, type Vec3 } from "./scene";

function obj(kind: string, p: Vec3, yaw: number, used: BlockObject[], patch: Partial<BlockObject> = {}): BlockObject {
  const o = { ...newObject(kind, p, yaw, used), ...patch };
  used.push(o);
  return o;
}

/** A camera key aimed from `p` at `look`. */
function ck(t: number, p: Vec3, look: Vec3, lens: number, ease: CamKey["ease"] = "smooth", roll = 0): CamKey {
  const a = aimAt(p, look);
  return { t, p, r: [a.yaw, a.pitch, roll], lens, ease };
}

export function stageScene(): BlockScene {
  const s = blankScene("Empty stage");
  const used: BlockObject[] = [];
  obj("person", [0, 0, 0], 0, used);
  s.objects = used;
  s.camera.keys = [ck(0, [0, 1.6, 6], [0, 1.4, 0], 35)];
  return s;
}

/**
 * A moving SUV on a coast road, a driver and passenger and a dog in the back.
 * The camera rides with the car (its keys are in the car's frame): behind,
 * alongside, in through the side window to the dog, out through the
 * windshield, ending ahead of the car looking back.
 */
export function coastRoadScene(): BlockScene {
  const s = blankScene("Coast road");
  s.duration = 12;
  s.environment = { sky: "#b8cfe3", ground: "grass", haze: 0.45, sunAz: 120, sunEl: 32 };
  const used: BlockObject[] = [];
  obj("road", [0, 0, 0], 0, used, { size: [8, 0.02, 400] });
  obj("sea", [-330, -0.5, 0], 0, used, { size: [600, 0.02, 800] });
  obj("hill", [32, 0, -40], 0, used, { size: [55, 18, 50] });
  obj("hill", [40, 0, 40], 0, used, { size: [70, 24, 60] });
  obj("hill", [28, 0, 120], 0, used, { size: [50, 14, 50] });
  obj("mountain", [120, 0, -260], 0, used);
  const car = obj("suv", [1.8, 0, -70], 0, used, { name: "Hero SUV" });
  // 140 m in 12 s is about 42 km/h: fast enough to read as driving.
  car.keys = [
    { t: 0, p: [1.8, 0, -70], r: [0, 0, 0], ease: "linear" },
    { t: 12, p: [1.8, 0, 70], r: [0, 0, 0], ease: "linear" },
  ];
  // In the car's own coordinates: the front row is about 0.9 m ahead of its
  // middle, the dog sits in the third row.
  obj("person", [-0.45, 0.5, 0.9], 0, used, { name: "Driver", pose: "seated", parent: car.id, size: [0.5, 1.78, 0.3] });
  obj("person", [0.45, 0.5, 0.9], 0, used, { name: "Passenger", pose: "seated", parent: car.id, size: [0.5, 1.68, 0.3] });
  const dog = obj("dog", [0, 0.92, -0.5], 0, used, { name: "Dog", pose: "seated", parent: car.id });
  s.objects = used;
  s.camera.parent = car.id;
  const dogHead: Vec3 = [0, 1.55, -0.4];
  s.camera.keys = [
    ck(0, [0.6, 1.7, -11], [0, 1.2, 0], 28),
    ck(2.5, [-3.2, 1.5, -2.2], [0, 1.2, 0], 28),
    ck(4.5, [-1.6, 1.45, -0.7], dogHead, 24),
    ck(6.2, [-0.35, 1.45, -0.2], dogHead, 21),
    ck(8.4, [0, 1.35, 2.2], [0, 1.25, -0.2], 24),
    ck(10.2, [0, 1.3, 6.5], [0, 1.0, 0], 28),
    ck(12, [0.4, 1.0, 11], [0, 0.9, 0], 32),
  ];
  // Locked on the dog the whole way, whatever the path does.
  s.camera.aim = { target: dog.id, frame: [0, 0] };
  return s;
}

export function cityStreetScene(): BlockScene {
  const s = blankScene("City street");
  s.duration = 8;
  s.environment = { sky: "#c3cbd4", ground: "asphalt", haze: 0.3, sunAz: 210, sunEl: 48 };
  const used: BlockObject[] = [];
  obj("road", [0, 0, 0], 0, used, { size: [10, 0.02, 300] });
  for (let i = -6; i <= 6; i++) {
    const h = 14 + ((i * 37 + 100) % 17);
    obj("building", [-16, 0, i * 16], 0, used, { size: [12, h, 13] });
    obj("building", [16, 0, i * 16 + 6], 0, used, { size: [12, h + 4, 13] });
    if (i % 2 === 0) {
      obj("lamppost", [-6.2, 0, i * 16], 90, used);
      obj("lamppost", [6.2, 0, i * 16 + 8], -90, used);
    }
  }
  const walker = obj("person", [-7.2, 0, -6], 0, used, { name: "Lead", pose: "walking" });
  // A brisk walk, 1.5 m/s.
  walker.keys = [
    { t: 0, p: [-7.2, 0, -6], r: [0, 0, 0], ease: "linear" },
    { t: 8, p: [-7.2, 0, 6], r: [0, 0, 0], ease: "linear" },
  ];
  obj("car", [2.5, 0, 10], 180, used, { name: "Parked car", color: "#6f9bd8" });
  s.objects = used;
  s.camera.keys = [
    ck(0, [-7.2, 1.5, 0.5], [-7.2, 1.5, -6], 40, "linear"),
    ck(8, [-7.2, 1.5, 9.5], [-7.2, 1.5, 6], 40),
  ];
  s.camera.aim = { target: walker.id, frame: [0, 0] };
  return s;
}

export function interiorScene(): BlockScene {
  const s = blankScene("Living room");
  s.duration = 6;
  s.environment = { sky: "#8f959c", ground: "studio", haze: 0, sunAz: 140, sunEl: 50 };
  const used: BlockObject[] = [];
  obj("room", [0, 0, 0], 0, used, { size: [6, 2.8, 7] });
  obj("sofa", [0, 0, -2.6], 0, used);
  obj("table", [0, 0, -1.1], 0, used, { size: [1.1, 0.42, 0.6], name: "Coffee table" });
  obj("person", [-0.4, 0, -2.5], 0, used, { pose: "seated" });
  obj("person", [0.5, 0, -2.5], 0, used, { pose: "seated" });
  s.objects = used;
  s.camera.keys = presetKeys("push", { p: [0, 1.3, 3], r: [0, -5, 0], lens: 28 }, [0, 1.0, -2.5], 0, 6);
  return s;
}

export function productScene(): BlockScene {
  const s = blankScene("Product orbit");
  s.duration = 8;
  s.environment = { sky: "#1d1f23", ground: "studio", haze: 0, sunAz: 140, sunEl: 55 };
  const used: BlockObject[] = [];
  obj("cylinder", [0, 0, 0], 0, used, { name: "Plinth", size: [0.5, 0.9, 0.5], color: "#e9e6df" });
  const hero = obj("product", [0, 0.9, 0], 0, used, { name: "Hero product" });
  s.objects = used;
  s.camera.keys = presetKeys("orbit-half", { p: [0, 1.25, 1.4], r: [0, 0, 0], lens: 65 }, [0, 1.03, 0], 0, 8);
  s.camera.aim = { target: hero.id, frame: [0, 0] };
  return s;
}

export function desertScene(): BlockScene {
  const s = blankScene("Desert reveal");
  s.duration = 10;
  s.environment = { sky: "#d9c8ae", ground: "sand", haze: 0.55, sunAz: 250, sunEl: 18 };
  const used: BlockObject[] = [];
  obj("rock", [-2.5, 0, -1], 0, used, { size: [3.2, 2.2, 2.6], name: "Foreground rock" });
  obj("rock", [9, 0, -20], 40, used, { size: [6, 3.5, 5] });
  obj("mountain", [-60, 0, -220], 0, used);
  obj("mountain", [80, 0, -260], 0, used, { size: [200, 90, 180] });
  const walker = obj("person", [1, 0, -8], 180, used, { name: "Traveller", pose: "walking" });
  walker.keys = [
    { t: 0, p: [1, 0, -8], r: [180, 0, 0], ease: "linear" },
    { t: 10, p: [1, 0, -20], r: [180, 0, 0], ease: "linear" },
  ];
  s.objects = used;
  s.camera.keys = [
    ck(0, [-2.6, 0.6, 2.8], [1, 1, -8], 24),
    ck(10, [-2.2, 6.5, 3.5], [1, 0.8, -20], 24),
  ];
  s.camera.aim = { target: walker.id, frame: [0, 0] };
  return s;
}

export const TEMPLATES: { id: string; name: string; hint: string; make: () => BlockScene }[] = [
  { id: "road", name: "Coast road", hint: "A moving SUV, people inside, a camera that rides with it", make: coastRoadScene },
  { id: "city", name: "City street", hint: "Buildings both sides, a walking lead, a tracking camera", make: cityStreetScene },
  { id: "interior", name: "Living room", hint: "Four walls, a sofa, two people, a push in", make: interiorScene },
  { id: "product", name: "Product orbit", hint: "A hero product on a plinth, a half orbit", make: productScene },
  { id: "desert", name: "Desert reveal", hint: "A traveller walking away, the camera rising over a rock", make: desertScene },
  { id: "stage", name: "Empty stage", hint: "One person and a camera. Build from there", make: stageScene },
];
