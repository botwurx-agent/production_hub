"use client";

// The phone as the camera in shot blocking (the desk half). The phone is
// opened from a QR code at /phone-camera?room=..., streams which way it is
// facing plus its thumb controls, and this hook turns that into a camera pose
// the studio draws instead of the keys. A TAKE records that pose in real time
// while the scene plays, and the studio writes it back as camera keys.
//
// An iPhone browser reports orientation only, never position, so aiming is by
// turning the phone and travel is by the thumb controls (push, truck, boom,
// zoom). Nothing here touches the database: the link is a broadcast channel,
// and only the studio's own commit writes a take into the scene.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import QRCode from "qrcode";
import { useLink } from "@/components/phone-cam/link";
import {
  clockOffset, nowMs, quantile, roomId, PoseTrack,
  type Angles, type DeskState, type Msg, type PhoneCmd, type Pose, type TakeSample,
} from "@/lib/phone-cam";

type Vec3 = [number, number, number];
export type LivePose = { p: Vec3; r: Vec3; lens: number };

/** How far behind real time the phone's pose is played, so a skipped beat glides. */
const DELAY_MS = 60;
/** Thumb control speeds at Normal: metres a second, and the lens's rate of change. */
const SPEED = { truck: 1, boom: 0.5, push: 1, zoom: 0.6 };
const COUNTDOWN_MS = 3000;

const D = Math.PI / 180;
const camFix = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const zAxis = new THREE.Vector3(0, 0, 1);

/** The phone's orientation as camera angles (yaw, pitch, roll, degrees), with its yaw as reported. */
function phoneAngles(p: Pose): Angles {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((p.b || 0) * D, (p.a || 0) * D, -(p.g || 0) * D, "YXZ"));
  q.multiply(camFix);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, -(p.o || 0) * D));
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  return [e.y / D, e.x / D, -e.z / D];
}

export type Take = {
  mode: "idle" | "count" | "rec";
  /** performance.now() the countdown ends at. */
  until: number;
  /** Scene time the take starts at. */
  startT: number;
  /** performance.now() recording began. */
  t0: number;
  samples: TakeSample[];
};

export function usePhoneCamera(handlers: { record: () => void; stop: () => void }) {
  const [room, setRoom] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [phoneSeen, setPhoneSeen] = useState(false);
  const [phoneLost, setPhoneLost] = useState(false);
  const [driving, setDrivingState] = useState(true);
  const drivingRef = useRef(true);
  const [level, setLevelState] = useState(true);
  const levelRef = useRef(true);
  const [delay, setDelay] = useState<number | null>(null);
  const [takeMode, setTakeMode] = useState<Take["mode"]>("idle");

  const track = useRef(new PoseTrack());
  const pad = useRef<{ m: [number, number, number, number]; at: number }>({ m: [0, 0, 0, 0], at: 0 });
  const lastPose = useRef(0);
  const pings = useRef<{ t0: number; tp: number; t3: number }[]>([]);
  const offset = useRef<{ offset: number; rtt: number } | null>(null);
  const ages = useRef<number[]>([]);
  const live = useRef<{ need: boolean; camYaw0: number; phoneYaw0: number; pos: Vec3; lens: number; last: LivePose | null }>({
    need: true, camYaw0: 0, phoneYaw0: 0, pos: [0, 1.6, 0], lens: 35, last: null,
  });
  const take = useRef<Take>({ mode: "idle", until: 0, startT: 0, t0: 0, samples: [] });
  const line = useRef<string | undefined>(undefined);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const triedDirect = useRef(false);

  const setDriving = useCallback((v: boolean) => {
    drivingRef.current = v;
    setDrivingState(v);
    if (v) live.current.need = true;
  }, []);
  const setLevel = useCallback((v: boolean) => {
    levelRef.current = v;
    setLevelState(v);
  }, []);

  const onCmd = (c: PhoneCmd) => {
    if (c === "recentre") live.current.need = true;
    else if (c === "drive") setDriving(true);
    else if (c === "record") handlersRef.current.record();
    else if (c === "stop") handlersRef.current.stop();
  };

  const link = useLink(room, "desk", (m: Msg) => {
    const now = nowMs();
    if (m.k === "hello" && m.from === "phone") setPhoneSeen(true);
    else if (m.k === "pong") {
      pings.current = [...pings.current.slice(-39), { t0: m.t0, tp: m.tp, t3: now }];
      offset.current = clockOffset(pings.current);
    } else if (m.k === "pose") {
      if (!lastPose.current) setPhoneSeen(true);
      lastPose.current = now;
      const off = offset.current;
      // Played on the phone's own clock when the two clocks are lined up, so
      // a burst of late arrivals keeps the spacing it was taken with.
      const t = off ? m.p.t - off.offset : now;
      track.current.push(t, phoneAngles(m.p));
      pad.current = { m: m.p.m ?? [0, 0, 0, 0], at: now };
      if (off) ages.current = [...ages.current.slice(-199), now - t];
    } else if (m.k === "cmd") onCmd(m.c);
  });
  const sendRef = useRef(link.send);
  sendRef.current = link.send;

  // Direct when it connects; the relay carries on if it does not.
  useEffect(() => {
    if (phoneSeen && link.status === "on" && link.direct === "none" && !triedDirect.current) {
      triedDirect.current = true;
      void link.goDirect();
    }
  }, [phoneSeen, link]);

  useEffect(() => {
    if (!room) return;
    const u = `${window.location.origin}/phone-camera?room=${room}`;
    setUrl(u);
    void QRCode.toDataURL(u, { margin: 1, width: 260 }).then(setQr);
  }, [room]);

  // Pings line the clocks up; the state tells the phone what to show.
  useEffect(() => {
    if (!room || link.status !== "on") return;
    let id = 0;
    const ping = setInterval(() => sendRef.current({ k: "ping", id: ++id, t0: nowMs() }), 500);
    const state = setInterval(() => {
      const tk = take.current;
      const now = performance.now();
      const s: DeskState =
        tk.mode === "count" ? { mode: "count", sec: Math.max(0, (tk.until - now) / 1000) }
          : tk.mode === "rec" ? { mode: "rec", sec: (now - tk.t0) / 1000 }
            : { mode: drivingRef.current ? "drive" : "view", line: line.current };
      sendRef.current({ k: "state", s });
      setDelay(quantile(ages.current, 0.95));
      setPhoneLost(lastPose.current > 0 && nowMs() - lastPose.current > 2500);
      setTakeMode(tk.mode);
    }, 250);
    return () => { clearInterval(ping); clearInterval(state); };
  }, [room, link.status]);

  const start = useCallback(() => {
    if (room) return;
    triedDirect.current = false;
    track.current.clear();
    lastPose.current = 0;
    setPhoneSeen(false);
    setRoom(roomId(12));
  }, [room]);

  const end = useCallback(() => {
    setRoom(null);
    setQr(null);
    setPhoneSeen(false);
    setPhoneLost(false);
    track.current.clear();
    lastPose.current = 0;
    take.current = { mode: "idle", until: 0, startT: 0, t0: 0, samples: [] };
    setTakeMode("idle");
    live.current.need = true;
  }, []);

  /** Whether the phone is the camera right now (a session, a pose, and driving or mid-take). */
  const active = useCallback(
    () => !!room && track.current.size > 0 && (drivingRef.current || take.current.mode !== "idle"),
    [room],
  );

  /**
   * The camera pose from the phone, in the camera's own (parent) frame.
   * `base` is where the camera is now, used when the phone is (re)centred:
   * the phone's current heading becomes the camera's heading, and travel and
   * zoom start from where the camera stands.
   */
  const frame = useCallback((dt: number, base: () => LivePose): LivePose | null => {
    if (!active()) return null;
    const L = live.current;
    const latest = track.current.latest();
    if (!latest) return null;
    if (L.need) {
      const b = base();
      L.camYaw0 = b.r[0];
      L.phoneYaw0 = latest[0];
      L.pos = [...b.p] as Vec3;
      L.lens = b.lens;
      L.need = false;
    }
    const a = track.current.at(nowMs() - DELAY_MS) ?? latest;
    const yaw = L.camYaw0 + (a[0] - L.phoneYaw0);
    const r: Vec3 = [yaw, Math.max(-89, Math.min(89, a[1])), levelRef.current ? 0 : a[2]];
    // Thumb controls: a stale reading (the link dropped) is nothing held.
    const m = nowMs() - pad.current.at > 500 ? [0, 0, 0, 0] : pad.current.m;
    if (m.some((v) => v !== 0)) {
      const y = yaw * D;
      const side = m[0] * SPEED.truck * dt;
      const fwd = m[2] * SPEED.push * dt;
      L.pos = [
        L.pos[0] + Math.cos(y) * side - Math.sin(y) * fwd,
        Math.max(0.05, L.pos[1] + m[1] * SPEED.boom * dt),
        L.pos[2] - Math.sin(y) * side - Math.cos(y) * fwd,
      ];
      L.lens = Math.min(600, Math.max(8, L.lens * Math.exp(m[3] * SPEED.zoom * dt)));
    }
    L.last = { p: [...L.pos] as Vec3, r, lens: L.lens };
    return L.last;
  }, [active]);

  const recentre = useCallback(() => { live.current.need = true; }, []);

  /** Starts the countdown to a take that begins at scene time startT. */
  const beginTake = useCallback((startT: number) => {
    if (!room || !track.current.size) return false;
    setDriving(true);
    take.current = { mode: "count", until: performance.now() + COUNTDOWN_MS, startT, t0: 0, samples: [] };
    line.current = undefined;
    setTakeMode("count");
    return true;
  }, [room, setDriving]);

  /** Ends a take (or a countdown) and hands back what was recorded. */
  const endTake = useCallback((summary?: string) => {
    const tk = take.current;
    const samples = tk.mode === "rec" ? tk.samples : [];
    const startT = tk.startT;
    take.current = { mode: "idle", until: 0, startT: 0, t0: 0, samples: [] };
    setTakeMode("idle");
    if (summary) line.current = summary;
    return { samples, startT };
  }, []);

  const status = useMemo(() => {
    if (!room) return "off" as const;
    if (link.status === "error") return "error" as const;
    if (!phoneSeen || track.current.size === 0) return "waiting" as const;
    if (phoneLost) return "lost" as const;
    return "live" as const;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, link.status, phoneSeen, phoneLost, delay]);

  return {
    room, qr, url, status, link, delay, driving, setDriving, level, setLevel, takeMode,
    start, end, active, frame, recentre, beginTake, endTake, take,
  };
}

export type PhoneCamera = ReturnType<typeof usePhoneCamera>;

/** The panel under the toolbar's Phone button. */
export function PhonePanel({ phone, startLabel, onTake }: { phone: PhoneCamera; startLabel: string; onTake: () => void }) {
  const p = phone;
  const s = p.status;
  const dot = (hue: string) => <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--h-${hue})` }} />;
  return (
    <div className="absolute right-0 top-9 z-30 w-[300px] rounded-[10px] border border-border bg-surface p-3 shadow-2xl">
      <p className="text-[12px] font-semibold text-text">Your phone as the camera</p>
      {s === "off" || s === "waiting" || s === "error" ? (
        <>
          <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
            Scan this with your phone and sign in. Turn the phone to aim; the thumb controls on it push in, truck, boom and zoom.
          </p>
          {p.qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.qr} alt="QR code to open the phone camera" className="mx-auto mt-3 h-[180px] w-[180px] rounded-md bg-white p-1" />
          ) : (
            <div className="mx-auto mt-3 h-[180px] w-[180px] rounded-md bg-surface-2" />
          )}
          {p.url && <p className="mt-1.5 break-all text-center text-[10px] text-text-faint">{p.url}</p>}
          <p className="mt-2 flex items-center justify-center gap-2 text-[11.5px] text-text-muted">
            {dot(s === "error" ? "red" : "amber")}
            {s === "error" ? p.link.error ?? "Could not open the link." : "Waiting for the phone"}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 flex items-center gap-2 text-[11.5px] text-text">
            {dot(s === "lost" ? "amber" : "green")}
            {s === "lost" ? "The phone has gone quiet. Is its screen on?" : `Phone connected, ${p.link.transport === "direct" ? "direct" : "through the relay"}${p.delay !== null ? `, ${Math.round(p.delay)} ms` : ""}`}
          </p>
          <div className="mt-3 flex rounded-[7px] border border-border bg-surface-2 p-0.5">
            {[
              { v: true, label: "Phone drives" },
              { v: false, label: "Show the keys" },
            ].map((o) => (
              <button key={o.label} type="button" onClick={() => p.setDriving(o.v)}
                className={`flex-1 rounded-[5px] px-2 py-1 text-[11.5px] font-semibold ${p.driving === o.v ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"}`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={p.recentre} className="flex-1 rounded-[7px] border border-border px-2 py-1.5 text-[11.5px] font-semibold text-text hover:bg-surface-2">
              Recentre
            </button>
            <button type="button" onClick={() => p.setLevel(!p.level)} className={`flex-1 rounded-[7px] border px-2 py-1.5 text-[11.5px] font-semibold ${p.level ? "border-accent text-text" : "border-border text-text-muted"}`}>
              {p.level ? "Horizon level" : "Phone roll on"}
            </button>
          </div>
          <button type="button" onClick={onTake} disabled={p.takeMode !== "idle"}
            className="mt-2 w-full rounded-[7px] bg-red px-2 py-2 text-[12px] font-bold text-white disabled:opacity-60">
            {p.takeMode === "count" ? "Get ready…" : p.takeMode === "rec" ? "Recording…" : `Record a take ${startLabel}`}
          </button>
          <p className="mt-2 text-[10.5px] leading-relaxed text-text-faint">
            A take counts down from 3, plays the scene in real time and records the camera into keyframes. It replaces the camera keys it covers; undo puts them back. You can also press Record on the phone.
          </p>
        </>
      )}
      {p.room && (
        <button type="button" onClick={p.end} className="mt-2 w-full rounded-[7px] border border-border px-2 py-1.5 text-[11.5px] text-text-muted hover:text-text">
          Disconnect the phone
        </button>
      )}
    </div>
  );
}
