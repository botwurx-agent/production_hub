"use client";

// Calibrating one phone camera: measure something of known width at a known
// distance, freeze the picture, put two lines on its edges. See lib/viewfinder.ts
// for why that gives an exact focal length rather than an estimate.
//
// The steps that buy accuracy, all deliberate:
// - The picture is FROZEN before measuring, so a shaky hand moves nothing.
// - A loupe magnifies the edge under your finger while you drag a line, and
//   nudge buttons move the active line one stream pixel at a time.
// - The lines live in STREAM pixels, so turning the phone or resizing never
//   moves them off the marks.
// - Several readings are averaged and their spread is shown, so a slipped tape
//   or a distance typed in the wrong unit stands out instead of hiding in a mean.
// - Tilt is read at the moment of freezing and called out when the phone was
//   not square to the wall.
import { useEffect, useRef, useState } from "react";
import {
  cameraTilt,
  focalNorm,
  longFovDeg,
  outlierDeg,
  parseDistance,
  summarize,
  type Reading,
} from "@/lib/viewfinder";
import { ffEquivalent, feet, metres } from "@/lib/previz/optics";
import { saveCalibration, type CameraCalibration } from "./calibration-store";

type Props = {
  stream: MediaStream;
  camera: { label: string; deviceId: string };
  initial: Reading[];
  units: "ft" | "m";
  onUnits: (u: "ft" | "m") => void;
  orientation: { beta: number; gamma: number } | null;
  onDone: (c: CameraCalibration | null) => void;
  onCancel: () => void;
};

const fmtDist = (m: number, u: "ft" | "m") => (u === "ft" ? feet(m) : metres(m));

export function Calibrate({ stream, camera, initial, units, onUnits, orientation, onDone, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frozenRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [media, setMedia] = useState({ w: 0, h: 0 });
  const [frozen, setFrozen] = useState(false);
  const [frozenTilt, setFrozenTilt] = useState<number | null>(null);
  const [lines, setLines] = useState<[number, number] | null>(null);
  const [active, setActive] = useState<0 | 1>(0);
  const [drag, setDrag] = useState<{ i: 0 | 1; y: number } | null>(null);
  const [widthText, setWidthText] = useState("");
  const [distText, setDistText] = useState("");
  const [readings, setReadings] = useState<Reading[]>(initial);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    const onMeta = () => setMedia({ w: v.videoWidth, h: v.videoHeight });
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("resize", onMeta);
    v.play().catch(() => {});
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("resize", onMeta);
    };
  }, [stream]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Default lines at a fifth in from each edge, set once the stream size is known.
  useEffect(() => {
    if (media.w && !lines) setLines([media.w * 0.2, media.w * 0.8]);
  }, [media.w, lines]);

  const s = media.w && stage.w ? Math.min(stage.w / media.w, stage.h / media.h) : 1;
  const ox = (stage.w - media.w * s) / 2;
  const oy = (stage.h - media.h * s) / 2;

  const freeze = () => {
    const v = videoRef.current;
    const c = frozenRef.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setMedia({ w: v.videoWidth, h: v.videoHeight });
    setFrozen(true);
    setFrozenTilt(orientation ? cameraTilt(orientation.beta, orientation.gamma) : null);
  };

  // Loupe: four times the picture around the dragged line, at the finger's height.
  useEffect(() => {
    const L = loupeRef.current;
    if (!L || !drag || !lines) return;
    const src: CanvasImageSource | null = frozen ? frozenRef.current : videoRef.current;
    if (!src) return;
    const g = L.getContext("2d");
    if (!g) return;
    const zoom = 4;
    const size = L.width;
    const cx = lines[drag.i];
    const cy = (drag.y - oy) / s;
    const half = 130 / (2 * zoom * s);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    g.drawImage(src, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
    g.strokeStyle = "#ffcc00";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(size / 2, 0);
    g.lineTo(size / 2, size);
    g.stroke();
  }, [drag, lines, frozen, s, oy]);

  const onDown = (i: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActive(i);
    setDrag({ i, y: e.clientY - (stageRef.current?.getBoundingClientRect().top ?? 0) });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !lines || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(media.w, (e.clientX - r.left - ox) / s));
    const next: [number, number] = [...lines] as [number, number];
    next[drag.i] = x;
    setLines(next);
    setDrag({ i: drag.i, y: e.clientY - r.top });
  };
  const onUp = () => setDrag(null);
  const nudge = (d: number) => {
    if (!lines) return;
    const next: [number, number] = [...lines] as [number, number];
    next[active] = Math.max(0, Math.min(media.w, next[active] + d));
    setLines(next);
  };

  const widthM = parseDistance(widthText, units);
  const distM = parseDistance(distText, units);
  const span = lines ? Math.abs(lines[1] - lines[0]) : 0;
  const draft: Reading | null =
    widthM && distM && span > 0 ? { widthM, distanceM: distM, spanPx: span, longPx: Math.max(media.w, media.h) } : null;
  const draftF = draft ? focalNorm(draft) : null;
  const draftFov = draftF ? longFovDeg(draftF) : null;

  const add = () => {
    setErr(null);
    if (!frozen) return setErr("Freeze the picture first, so the lines sit still on the marks.");
    if (!widthM) return setErr(`Enter the width between the marks, like ${units === "ft" ? `4' or 48"` : "1.2 m"}.`);
    if (!distM) return setErr(`Enter the distance from the lens to the wall, like ${units === "ft" ? `8' 6"` : "2.6 m"}.`);
    if (!draft || !draftFov) return setErr("Put the two lines on the marks.");
    if (span < media.w * 0.25) return setErr("The marks cover too little of the picture. Step closer or use wider marks, so they span at least a third of the frame.");
    if (draftFov < 8 || draftFov > 140) return setErr(`That works out to ${draftFov.toFixed(0)} degrees across, which no phone lens is. Check the width and the distance, and their units.`);
    setReadings((r) => [...r, draft]);
    setFrozen(false);
  };

  const sum = summarize(readings);
  const tiltOff = frozenTilt !== null && Math.abs(frozenTilt) > 4;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white landscape:flex-row">
      <div ref={stageRef} className="relative min-h-0 flex-1 touch-none overflow-hidden" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <video ref={videoRef} playsInline muted autoPlay className="absolute" style={{ left: ox, top: oy, width: media.w * s, height: media.h * s, visibility: frozen ? "hidden" : "visible" }} />
        <canvas ref={frozenRef} className="absolute" style={{ left: ox, top: oy, width: media.w * s, height: media.h * s, visibility: frozen ? "visible" : "hidden" }} />
        {lines && media.w > 0 && ([0, 1] as const).map((i) => (
          <div key={i} className="absolute top-0 h-full" style={{ left: ox + lines[i] * s - 22, width: 44 }} onPointerDown={onDown(i)}>
            <div className={`absolute left-1/2 top-0 h-full w-px -translate-x-1/2 ${active === i ? "bg-[#ffcc00]" : "bg-white/80"}`} />
            <div className={`absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-2 text-xs font-bold ${active === i ? "border-[#ffcc00] bg-black/70 text-[#ffcc00]" : "border-white bg-black/60"}`}>
              {i === 0 ? "L" : "R"}
            </div>
          </div>
        ))}
        {drag && lines && (
          <canvas
            ref={loupeRef}
            width={260}
            height={260}
            className="pointer-events-none absolute h-[130px] w-[130px] rounded-full border-2 border-[#ffcc00] shadow-lg"
            style={{ left: Math.max(4, Math.min(stage.w - 134, ox + lines[drag.i] * s - 65)), top: Math.max(4, drag.y - 170) }}
          />
        )}
        <div className="absolute left-3 top-3 max-w-[70%] rounded-lg bg-black/60 px-2.5 py-1.5 text-xs leading-snug">
          {frozen ? "Drag L and R onto the two marks. The magnifier shows the edge." : "Aim at the marks, hold still, then Freeze."}
        </div>
      </div>

      <div className="max-h-[52dvh] shrink-0 overflow-y-auto border-white/15 bg-[#111] p-4 text-sm landscape:max-h-none landscape:w-[340px] landscape:border-l portrait:border-t">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold">Calibrate this camera</div>
            <div className="text-xs text-white/60">{camera.label || "Camera"}</div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-white/70 hover:bg-white/10">Close</button>
        </div>

        <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/75">
          <li>Put two marks on a flat wall a measured distance apart (tape 4 ft apart works). Wide marks are more exact: let them span most of the picture.</li>
          <li>Stand square to the wall and measure from the phone&apos;s lens to the wall. Six to twelve feet is ideal.</li>
          <li>Freeze, drag the lines onto the marks, then Add reading. Two or three readings at different distances make it exact.</li>
        </ol>

        <div className="mt-3 flex gap-1 text-xs">
          {(["ft", "m"] as const).map((u) => (
            <button key={u} type="button" onClick={() => onUnits(u)} className={`rounded-md px-2.5 py-1 ${units === u ? "bg-white text-black" : "bg-white/10"}`}>
              {u === "ft" ? "Feet" : "Metres"}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-white/70">
            Between the marks
            <input value={widthText} onChange={(e) => setWidthText(e.target.value)} inputMode="decimal" placeholder={units === "ft" ? `4'` : "1.2 m"} className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-2 text-base text-white" />
          </label>
          <label className="text-xs text-white/70">
            Lens to wall
            <input value={distText} onChange={(e) => setDistText(e.target.value)} inputMode="decimal" placeholder={units === "ft" ? `8' 6"` : "2.6 m"} className="mt-1 w-full rounded-md border border-white/20 bg-black px-2 py-2 text-base text-white" />
          </label>
        </div>
        <div className="mt-1 text-[11px] text-white/50">
          {widthM ? `Width ${fmtDist(widthM, units)}` : "Width not read yet"} · {distM ? `distance ${fmtDist(distM, units)}` : "distance not read yet"}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => (frozen ? setFrozen(false) : freeze())} className="rounded-lg bg-white px-3 py-2 font-semibold text-black">
            {frozen ? "Back to live" : "Freeze"}
          </button>
          <button type="button" onClick={() => nudge(-1)} aria-label="Nudge line left" className="rounded-lg bg-white/10 px-3 py-2">‹</button>
          <button type="button" onClick={() => nudge(1)} aria-label="Nudge line right" className="rounded-lg bg-white/10 px-3 py-2">›</button>
          <span className="text-xs text-white/60">moves {active === 0 ? "L" : "R"} one pixel</span>
        </div>
        {tiltOff && frozen && (
          <p className="mt-2 rounded-md border border-[#f5b301]/60 bg-[#f5b301]/15 px-2 py-1.5 text-xs">
            The phone was tilted {Math.abs(frozenTilt!).toFixed(0)}° {frozenTilt! < 0 ? "down" : "up"} when frozen. For an exact reading hold it level, square to the wall.
          </p>
        )}
        {draftFov && frozen && (
          <p className="mt-2 text-xs text-white/70">
            This reading: {draftFov.toFixed(1)}° across, like a {ffEquivalent(draftFov).toFixed(1)}mm on full frame.
          </p>
        )}
        {err && <p className="mt-2 rounded-md border border-[#ff6b6b]/60 bg-[#ff6b6b]/15 px-2 py-1.5 text-xs">{err}</p>}
        <button type="button" onClick={add} disabled={!frozen} className="mt-3 w-full rounded-lg bg-[#ffcc00] px-3 py-2.5 font-semibold text-black disabled:opacity-40">
          Add reading
        </button>

        {readings.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Readings</div>
            <ul className="mt-1 divide-y divide-white/10">
              {readings.map((r, i) => {
                const f = focalNorm(r);
                const fov = f ? longFovDeg(f) : 0;
                const off = readings.length > 2 ? outlierDeg(readings, i) : 0;
                return (
                  <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                    <span>
                      {fov.toFixed(1)}° at {fmtDist(r.distanceM, units)}
                      {off > 1 && <span className="ml-1.5 text-[#f5c542]">{off.toFixed(1)}° off the others</span>}
                    </span>
                    <button type="button" onClick={() => setReadings((all) => all.filter((_, j) => j !== i))} className="rounded px-1.5 text-white/60 hover:bg-white/10">Remove</button>
                  </li>
                );
              })}
            </ul>
            {sum && (
              <p className="mt-2 text-xs leading-relaxed text-white/80">
                {sum.fovDeg.toFixed(1)}° across the long side, like a {ffEquivalent(sum.fovDeg).toFixed(1)}mm on full frame.
                {sum.count > 1 ? ` ${sum.count} readings agree within ${sum.spreadDeg.toFixed(1)}°.` : " Add one more at another distance to confirm it."}
                {sum.count > 1 && sum.spreadDeg > 1.5 ? " That spread is wide: remove the odd one out or take another." : ""}
              </p>
            )}
            <button
              type="button"
              onClick={() => onDone(saveCalibration(camera, readings))}
              className="mt-3 w-full rounded-lg bg-white px-3 py-2.5 font-semibold text-black"
            >
              Use this calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
