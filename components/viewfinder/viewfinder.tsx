"use client";

// The director's viewfinder on a phone: pick a camera body, a lens and a
// delivery aspect, and the phone's own camera shows exactly that frame, with
// the picture outside it dimmed the way a cine monitor's surround is. Tilt and
// roll come off the motion sensor. A still keeps every one of those facts and
// lands in the project's location stills, where it can become a scene.
//
// Always a dark surface, whatever the app theme, for the same reason the
// triage overlay is: you are judging a picture, and a bright frame around it
// changes how it reads.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASPECTS, BODIES, PRIMES, fovDeg, imagedArea } from "@/lib/previz/optics";
import {
  bestCamera,
  bodyById,
  cameraRoll,
  cameraTilt,
  cropFor,
  longFovDeg,
  targetTans,
  widestFocal,
  type Crop,
} from "@/lib/viewfinder";
import { uploadDirect } from "@/components/upload/direct-upload";
import { saveLocationStill } from "@/app/(app)/projects/[id]/still-actions";
import { actionError } from "@/lib/action-result";
import { Calibrate } from "./calibrate";
import {
  allCalibrations,
  camKey,
  clearCalibration,
  readSettings,
  writeSettings,
  type CameraCalibration,
} from "./calibration-store";

type Props = {
  projectId: string;
  projectTitle: string;
  canEdit: boolean;
  stillsHref: string;
  backHref: string;
};

type Cam = { deviceId: string; label: string };

/**
 * One set of constraints for every stream, live and calibrating alike, so a
 * calibration taken on one stream is valid on the next. A 4:3 request keeps
 * the whole sensor height on most phones, which a tall delivery needs.
 */
const STREAM = { width: { ideal: 1920 }, height: { ideal: 1440 } };

/**
 * Until a camera is calibrated: a phone main camera's typical field (about a
 * 26mm on full frame), so the frame lines are usable and SAID to be rough.
 */
const ROUGH_FNORM = 0.722;

/**
 * Safari and Chrome list "virtual" cameras that hop between the phone's lenses
 * by themselves as you move closer or zoom. A calibration on one of those
 * describes whichever lens it happened to be on, so they are ranked last and
 * named as such in the picker.
 */
const isVirtual = (label: string) => /dual|triple|multi/i.test(label);
const isBack = (label: string) => /back|rear|environment|facing back|camera2 0|0, facing back/i.test(label) || !/front|user|facetime/i.test(label);

function rankCams(list: Cam[]): Cam[] {
  return [...list]
    .filter((c) => isBack(c.label))
    .sort((a, b) => Number(isVirtual(a.label)) - Number(isVirtual(b.label)));
}

/**
 * Smooths the motion sensor so the readout does not shimmer, and works out
 * which way the phone is physically HELD, separately from which way the page
 * is drawn. The two differ whenever rotation lock is on, which is most
 * iPhones: the phone turns sideways and the page does not, so the frame has to
 * turn itself the way the built-in camera app does.
 *
 * `held` uses the screen.orientation convention: 0 upright, 90 turned
 * counterclockwise (top to the left), 270 clockwise. Read off gravity in the
 * device's own axes, with hysteresis so a phone held near 45 degrees does not
 * flicker between the two, and lying flat keeps whatever it was.
 */
function useOrientation(enabled: boolean) {
  const [o, setO] = useState<{ beta: number; gamma: number; angle: number; held: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let last: { beta: number; gamma: number } | null = null;
    let held = 0;
    const onO = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const k = 0.25;
      last = last ? { beta: last.beta + (e.beta - last.beta) * k, gamma: last.gamma + (e.gamma - last.gamma) * k } : { beta: e.beta, gamma: e.gamma };
      const angle =
        (typeof screen !== "undefined" && screen.orientation?.angle) ??
        ((window as unknown as { orientation?: number }).orientation ?? 0);
      // Gravity in device axes (x right, y up the screen in portrait).
      const b = (last.beta * Math.PI) / 180;
      const g = (last.gamma * Math.PI) / 180;
      const gx = Math.cos(b) * Math.sin(g);
      const gy = -Math.sin(b);
      const margin = 0.3;
      if (Math.abs(gx) > 0.5 && Math.abs(gx) > Math.abs(gy) + margin) held = gx < 0 ? 90 : 270;
      else if (Math.abs(gy) > 0.5 && Math.abs(gy) > Math.abs(gx) + margin) held = gy < 0 ? 0 : 180;
      setO({ ...last, angle: ((Number(angle) % 360) + 360) % 360, held });
    };
    window.addEventListener("deviceorientation", onO);
    return () => window.removeEventListener("deviceorientation", onO);
  }, [enabled]);
  return o;
}

export function Viewfinder({ projectId, projectTitle, canEdit, stillsHref, backHref }: Props) {
  const saved = useMemo(() => (typeof window === "undefined" ? {} : readSettings()), []);
  const [bodyId, setBodyId] = useState(saved.bodyId && BODIES.some((b) => b.id === saved.bodyId) ? saved.bodyId : "alexamini");
  const [focal, setFocal] = useState(typeof saved.focal === "number" ? saved.focal : 35);
  const [aspectId, setAspectId] = useState(saved.aspectId && ASPECTS.some((a) => a.id === saved.aspectId) ? saved.aspectId : "16x9");
  const [units, setUnits] = useState<"ft" | "m">(saved.units === "m" ? "m" : "ft");
  const [autoCam, setAutoCam] = useState(saved.autoCam !== false);
  useEffect(() => writeSettings({ bodyId, focal, aspectId, units, autoCam }), [bodyId, focal, aspectId, units, autoCam]);

  const [started, setStarted] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);
  const [motion, setMotion] = useState(false);
  const [cams, setCams] = useState<Cam[]>([]);
  const [cam, setCam] = useState<Cam | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [media, setMedia] = useState({ w: 0, h: 0 });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [cal, setCal] = useState<Record<string, CameraCalibration>>({});
  const [calibrating, setCalibrating] = useState(false);
  const [sheet, setSheet] = useState<null | "body" | "camera">(null);
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState(0);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const orient = useOrientation(motion);

  const body = bodyById(bodyId);
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];
  const tans = targetTans(body, focal, aspect.ratio);

  // How far the phone is turned against the page. 90 or 270 means it is held
  // sideways while the page stayed upright (rotation lock): the shot's width
  // then runs DOWN the screen, so the frame is drawn tall, the crop swaps its
  // axes, and the readout and the saved still are turned to match the hand.
  const turn = orient ? (((orient.held - orient.angle) % 360) + 360) % 360 : 0;
  const sideways = turn === 90 || turn === 270;
  const textTurn = turn === 90 ? 90 : turn === 270 ? -90 : 0;
  const onScreenTans = sideways ? { tanX: tans.tanY, tanY: tans.tanX } : tans;
  // The stream as the frame sees it: held sideways, the shot is as wide as
  // the stream is tall.
  const viewStream = (m: { w: number; h: number }) => (sideways ? { w: m.h, h: m.w } : m);
  const ratio = sideways ? 1 / aspect.ratio : aspect.ratio;


  useEffect(() => setCal(allCalibrations()), []);

  // ----- Stream
  // The live stream is held in a ref as well as state, so opening a second
  // camera always stops the first, even from inside one async function.
  const streamRef = useRef<MediaStream | null>(null);
  const open = useCallback(async (c: Cam | null) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const s = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: c ? { ...STREAM, deviceId: { exact: c.deviceId } } : { ...STREAM, facingMode: { ideal: "environment" } },
    });
    streamRef.current = s;
    setStream(s);
    return s;
  }, []);

  const start = async () => {
    setStartErr(null);
    // iOS asks for motion access only from a tap, so it is requested here.
    try {
      const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
      if (req) setMotion((await req()) === "granted");
      else setMotion(true);
    } catch {
      setMotion(false);
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open the camera. Try Safari on iPhone or Chrome on Android.");
      const first = await open(null);
      const list = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      const ranked = rankCams(list);
      setCams(ranked);
      const settings = first.getVideoTracks()[0]?.getSettings();
      const current = ranked.find((c) => c.deviceId === settings?.deviceId);
      // Prefer the plain main camera over a lens-hopping virtual one.
      const main = ranked.find((c) => /^back camera$/i.test(c.label.trim())) ?? ranked.find((c) => !isVirtual(c.label)) ?? current ?? null;
      if (main && main.deviceId !== current?.deviceId) await open(main);
      setCam(main ?? current ?? null);
      setStarted(true);
      try {
        await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock?.request("screen");
      } catch {
        /* optional */
      }
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setStartErr(
        name === "NotAllowedError"
          ? "Camera access was refused. Allow the camera for this site in your browser settings, then try again."
          : e instanceof Error ? e.message : "The camera could not be opened.",
      );
    }
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    const onMeta = () => setMedia({ w: v.videoWidth, h: v.videoHeight });
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("resize", onMeta);
    v.play().catch(() => {});
    // Some mobile browsers swap the stream's width and height on rotation
    // without firing "resize", which would leave the frame cropped against
    // the old shape. A cheap poll catches it.
    const poll = window.setInterval(() => {
      setMedia((m) => (m.w === v.videoWidth && m.h === v.videoHeight ? m : { w: v.videoWidth, h: v.videoHeight }));
    }, 500);
    return () => {
      window.clearInterval(poll);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("resize", onMeta);
    };
    // `started` too: the stream arrives one render before the picture exists.
  }, [stream, calibrating, started]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [started]);

  const calOf = (c: Cam | null) => (c ? cal[camKey(c)] ?? Object.values(cal).find((x) => x.deviceId === c.deviceId) ?? null : null);
  const current = calOf(cam);
  const fNorm = current?.fNorm ?? ROUGH_FNORM;

  // Auto: frame through the calibrated camera that shows the whole frame with
  // the least cropping. Only calibrated cameras take part, since an unmeasured
  // one cannot be compared.
  useEffect(() => {
    if (!autoCam || !started || calibrating || !media.w) return;
    const calibrated = cams
      .map((c) => ({ c, k: calOf(c) }))
      .filter((x): x is { c: Cam; k: CameraCalibration } => !!x.k)
      .map((x) => ({ id: x.c.deviceId, label: x.c.label, fNorm: x.k.fNorm }));
    if (calibrated.length < 2) return;
    const pick = bestCamera(calibrated, viewStream(media), tans);
    if (pick && pick.id !== cam?.deviceId) {
      const next = cams.find((c) => c.deviceId === pick.id) ?? null;
      if (next) {
        setCam(next);
        open(next).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCam, started, calibrating, focal, bodyId, aspectId, media.w, media.h, cal, cams.length, sideways]);

  const crop: Crop | null = media.w ? cropFor(fNorm, media, onScreenTans) : null;

  // The frame fitted into the stage, then the stream scaled so the crop lands
  // exactly on it.
  const M = 10;
  const fw = Math.max(0, Math.min(stage.w - 2 * M, (stage.h - 2 * M) * ratio));
  const fh = fw / ratio;
  const fx = (stage.w - fw) / 2;
  const fy = (stage.h - fh) / 2;
  const sc = crop ? fw / crop.w : 1;

  const tilt = orient ? cameraTilt(orient.beta, orient.gamma) : null;
  // Level is read against the way the phone is HELD, so sideways under
  // rotation lock it still means the horizon of the shot.
  const roll = orient ? cameraRoll(orient.beta, orient.gamma, sideways ? orient.held : orient.angle) : null;
  const level = roll !== null && Math.abs(roll) < 0.5;

  const hfov = fovDeg(imagedArea(body, aspect.ratio).w, focal);
  const widest = media.w ? widestFocal(fNorm, viewStream(media), body, aspect.ratio) : null;

  // ----- Capture
  const capture = () => {
    const v = videoRef.current;
    if (!v || !crop || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    // Output at the stream's own resolution for the cropped area, capped so a
    // wide frame does not become an enormous file. Where the lens sees past
    // this phone camera the frame is padded black, so the still is the LENS's
    // frame and says so, rather than a smaller one passed off as it.
    const scale = Math.min(1, 4096 / Math.max(crop.w, crop.h));
    const cw = Math.max(1, Math.round(crop.w * scale));
    const ch = Math.max(1, Math.round(crop.h * scale));
    // Held sideways under rotation lock, the picture on screen is on its side,
    // so the still is turned upright before it is saved.
    const W = sideways ? ch : cw;
    const H = sideways ? cw : ch;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    if (turn === 90) {
      g.translate(0, H);
      g.rotate(-Math.PI / 2);
    } else if (turn === 270) {
      g.translate(W, 0);
      g.rotate(Math.PI / 2);
    }
    const sx = Math.max(0, crop.x);
    const sy = Math.max(0, crop.y);
    const sw = Math.min(v.videoWidth, crop.x + crop.w) - sx;
    const sh = Math.min(v.videoHeight, crop.y + crop.h) - sy;
    g.drawImage(v, sx, sy, sw, sh, (sx - crop.x) * scale, (sy - crop.y) * scale, sw * scale, sh * scale);
    const meta = {
      bodyId, focal, aspectId,
      tilt: tilt !== null ? Math.round(tilt * 10) / 10 : null,
      roll: roll !== null ? Math.round(roll * 10) / 10 : null,
      phoneCamera: cam?.label ? `${cam.label}${current ? "" : " (not calibrated)"}` : null,
    };
    c.toBlob((blob) => {
      if (!blob) return;
      setLastShot(URL.createObjectURL(blob));
      if (!canEdit) return;
      setPending((n) => n + 1);
      // One at a time, in order, so a burst does not race on a weak signal.
      queue.current = queue.current.then(async () => {
        try {
          const file = new File([blob], `still-${Date.now()}.jpg`, { type: "image/jpeg" });
          const up = await uploadDirect({ kind: "location_still", projectId }, file);
          const res = await saveLocationStill({
            projectId, path: up.path, width: W, height: H,
            bodyId: meta.bodyId, focalMm: meta.focal, aspectId: meta.aspectId,
            tiltDeg: meta.tilt, rollDeg: meta.roll, phoneCamera: meta.phoneCamera, note: null,
          });
          const err = actionError(res);
          setToast(err ? `Not saved: ${err}` : "Saved to location stills");
        } catch (e) {
          setToast(`Not saved: ${e instanceof Error ? e.message : "the upload failed"}`);
        } finally {
          setPending((n) => n - 1);
          setTimeout(() => setToast(null), 2600);
        }
      });
    }, "image/jpeg", 0.92);
  };

  // Keep the chosen lens in view in the strip, however it was picked.
  const lensStrip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lensStrip.current?.querySelector<HTMLElement>('[data-on="1"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [focal, started, calibrating]);

  const stepFocal = (d: number) => setFocal((f) => Math.max(8, Math.min(400, Math.round(f) + d)));

  // ----- Screens
  if (!started) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-black px-6 text-center text-white">
        <div className="max-w-sm">
          <div className="text-xs uppercase tracking-[0.14em] text-white/50">{projectTitle}</div>
          <h1 className="mt-2 text-2xl font-semibold">Viewfinder</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/75">
            Pick a camera and lens and see its exact frame through your phone. Stills keep the lens, aspect and tilt, and land in this project&apos;s location stills.
          </p>
          <p className="mt-2 text-sm text-white/55">It asks for the camera and, on iPhone, for motion access (for tilt and level).</p>
        </div>
        <button type="button" onClick={start} className="rounded-full bg-white px-7 py-3 text-base font-semibold text-black">
          Start the camera
        </button>
        {startErr && <p className="max-w-sm rounded-lg border border-[#ff6b6b]/60 bg-[#ff6b6b]/15 px-3 py-2 text-sm">{startErr}</p>}
        <Link href={backHref} className="text-sm text-white/60 underline">Back to the project</Link>
      </div>
    );
  }

  if (calibrating && stream && cam) {
    return (
      <Calibrate
        stream={stream}
        camera={cam}
        initial={current?.readings ?? []}
        units={units}
        onUnits={setUnits}
        orientation={orient}
        onCancel={() => setCalibrating(false)}
        onDone={(c) => {
          setCal(allCalibrations());
          setCalibrating(false);
          if (c) setToast(`Calibrated: ${longFovDeg(c.fNorm).toFixed(1)}° across`);
          setTimeout(() => setToast(null), 2600);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white landscape:flex-row">
      {/* Top bar. Held sideways it floats over the picture instead, so the
          frame gets the whole height of the screen. */}
      <div className="flex shrink-0 items-center gap-2 px-3 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm landscape:absolute landscape:left-[max(0.25rem,env(safe-area-inset-left))] landscape:right-[132px] landscape:top-0 landscape:z-10">
        <Link href={backHref} aria-label="Close the viewfinder" className="rounded-full bg-white/10 px-3 py-1.5">Close</Link>
        <button type="button" onClick={() => setSheet(sheet === "body" ? null : "body")} className="min-w-0 truncate rounded-full bg-white/10 px-3 py-1.5">
          {body.name} · {aspect.label}
        </button>
        <button type="button" onClick={() => setSheet(sheet === "camera" ? null : "camera")} className={`ml-auto shrink-0 rounded-full px-3 py-1.5 ${current ? "bg-white/10" : "bg-[#f5b301] text-black"}`}>
          {current ? "Calibrated" : "Calibrate"}
        </button>
      </div>

      {/* Picture */}
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {/* ONE video element whatever the state, so the stream bound to it on
            mount is never stranded on an element that has gone. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute max-w-none"
          style={crop
            ? { left: fx - crop.x * sc, top: fy - crop.y * sc, width: media.w * sc, height: media.h * sc }
            : { left: 0, top: 0, width: 1, height: 1, opacity: 0 }}
        />
        {/* Surround dimmed, frame lines, centre cross. */}
        <div
          className="pointer-events-none absolute border border-white/90"
          style={{ left: fx, top: fy, width: fw, height: fh, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
        >
          <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
          <div className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
          {roll !== null && (
            <div
              className={`absolute left-1/2 top-1/2 h-[2px] w-1/3 -translate-x-1/2 -translate-y-1/2 ${level ? "bg-[#3ddc84]" : "bg-white/60"}`}
              style={{ transform: `translate(-50%, -50%) rotate(${textTurn - roll}deg)` }}
            />
          )}
        </div>
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

        {/* Readout */}
        <div
          className="pointer-events-none absolute whitespace-nowrap"
          style={sideways
            ? { left: turn === 90 ? fx + fw - 16 : fx + 16, top: fy + fh / 2, transform: `translate(-50%, -50%) rotate(${textTurn}deg)` }
            : { left: stage.w / 2, top: Math.max(4, fy + 6), transform: "translateX(-50%)" }}
        >
          <div className="rounded-md bg-black/55 px-2 py-0.5 text-xs tabular-nums">
            {Math.round(focal)}mm · {hfov.toFixed(1)}° across
            {tilt !== null && ` · tilt ${Math.abs(tilt).toFixed(0)}° ${tilt < -0.5 ? "down" : tilt > 0.5 ? "up" : ""}`}
            {roll !== null && ` · ${level ? "level" : `${Math.abs(roll).toFixed(1)}° off level`}`}
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex flex-col items-center gap-1">
          {!current && (
            <button type="button" onClick={() => setCalibrating(true)} className="rounded-md bg-[#f5b301] px-2.5 py-1 text-xs font-semibold text-black">
              Not calibrated: frame lines are approximate. Calibrate (about two minutes)
            </button>
          )}
          {crop && !crop.fits && (
            <div className="rounded-md bg-black/70 px-2.5 py-1 text-xs">
              Wider than this phone camera sees{widest ? `: ${widest}mm is the widest it can show` : ""}. The black edges are outside it.
            </div>
          )}
          {stage.h > stage.w && aspect.ratio > 1 && !sideways && (
            <div className="rounded-md bg-black/70 px-2.5 py-1 text-xs">Turn the phone sideways for a bigger frame.</div>
          )}
          {toast && <div className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-black">{toast}</div>}
        </div>

        {sheet && (
          <div className="absolute inset-x-0 top-0 max-h-[75%] overflow-y-auto border-b border-white/15 bg-[#111]/95 p-3 text-sm">
            {sheet === "body" && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Delivery aspect</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ASPECTS.map((a) => (
                    <button key={a.id} type="button" onClick={() => setAspectId(a.id)} className={`rounded-full px-3 py-1.5 ${a.id === aspectId ? "bg-white text-black" : "bg-white/10"}`}>{a.label}</button>
                  ))}
                </div>
                {(["cinema", "compact"] as const).map((grp) => (
                  <div key={grp} className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{grp === "cinema" ? "Cinema cameras" : "Compact and mirrorless"}</div>
                    <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {BODIES.filter((b) => b.group === grp).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => { setBodyId(b.id); setSheet(null); }}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-left ${b.id === bodyId ? "bg-white text-black" : "bg-white/5"}`}
                        >
                          <span>{b.name}</span>
                          <span className={b.id === bodyId ? "text-black/60" : "text-white/45"}>{b.format}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            {sheet === "camera" && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Phone camera</div>
                <ul className="mt-1.5 space-y-1">
                  {cams.map((c) => {
                    const k = calOf(c);
                    return (
                      <li key={c.deviceId}>
                        <button
                          type="button"
                          onClick={() => { setAutoCam(false); setCam(c); open(c).catch(() => {}); }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left ${c.deviceId === cam?.deviceId ? "bg-white text-black" : "bg-white/5"}`}
                        >
                          <span className="min-w-0 truncate">{c.label || "Camera"}{isVirtual(c.label) ? " (switches lenses by itself)" : ""}</span>
                          <span className="shrink-0 text-xs opacity-70">{k ? `${longFovDeg(k.fNorm).toFixed(1)}°` : "not calibrated"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={autoCam} onChange={(e) => setAutoCam(e.target.checked)} />
                  Pick the sharpest calibrated camera for each lens
                </label>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  Calibrate each lens you want to use (main, ultra wide, telephoto). A long lens through the telephoto is sharper than through the main camera&apos;s middle. Calibrations live on this phone.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setSheet(null); setCalibrating(true); }} className="rounded-lg bg-white px-3 py-2 font-semibold text-black">
                    {current ? "Recalibrate this camera" : "Calibrate this camera"}
                  </button>
                  {current && cam && (
                    <button type="button" onClick={() => { clearCalibration(cam); setCal(allCalibrations()); }} className="rounded-lg bg-white/10 px-3 py-2">Clear calibration</button>
                  )}
                </div>
              </>
            )}
            <button type="button" onClick={() => setSheet(null)} className="mt-3 w-full rounded-lg bg-white/10 py-2">Done</button>
          </div>
        )}
      </div>

      {/* Lenses and shutter: a strip below in portrait, a column at the side
          held sideways (where a camera app keeps its shutter). */}
      <div className="flex shrink-0 flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 landscape:w-[132px] landscape:flex-row-reverse landscape:gap-1 landscape:py-2 landscape:pr-[max(0.5rem,env(safe-area-inset-right))]">
        <div className="flex min-h-0 items-center gap-2 px-3 landscape:flex-col landscape:px-0">
          <button type="button" onClick={() => stepFocal(-1)} aria-label="1mm wider" className="h-9 w-9 shrink-0 rounded-full bg-white/10 text-lg">−</button>
          <div ref={lensStrip} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] landscape:min-h-0 landscape:flex-col landscape:overflow-y-auto landscape:overflow-x-hidden">
            {PRIMES.map((f) => (
              <button
                key={f}
                type="button"
                data-on={Math.round(focal) === f ? "1" : undefined}
                onClick={() => setFocal(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm tabular-nums ${Math.round(focal) === f ? "bg-white font-semibold text-black" : "bg-white/10"} ${widest && f < widest ? "opacity-50" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => stepFocal(1)} aria-label="1mm longer" className="h-9 w-9 shrink-0 rounded-full bg-white/10 text-lg">+</button>
        </div>
        <div className="mt-2 flex items-center justify-between px-6 landscape:mt-0 landscape:flex-1 landscape:flex-col landscape:justify-between landscape:px-0 landscape:py-1">
          <Link href={stillsHref} className="relative h-12 w-12 overflow-hidden rounded-lg border border-white/30 bg-white/5" aria-label="Location stills">
            {lastShot && <img src={lastShot} alt="" className="h-full w-full object-cover" />}
            {pending > 0 && <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[10px]">saving {pending}</span>}
          </Link>
          <button
            type="button"
            onClick={capture}
            disabled={!crop}
            aria-label="Take a still"
            className="h-[68px] w-[68px] rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-40"
          />
          <div className="w-12 text-center text-[10px] leading-tight text-white/55">
            {canEdit ? "Saves to stills" : "View only: not saved"}
          </div>
        </div>
      </div>
    </div>
  );
}
