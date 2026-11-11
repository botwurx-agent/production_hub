"use client";

// The phone half of the phone camera in shot blocking (/phone-camera?room=).
// Turning the phone aims the camera; the thumb controls push in, truck, boom
// and zoom; Record starts a take on the computer. The phone shows controls,
// not the picture: the shot is on the computer's screen.

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useLink } from "@/components/phone-cam/link";
import { nowMs, type DeskState, type PhoneCmd } from "@/lib/phone-cam";

type Axis = 0 | 1 | 2 | 3; // truck, boom, push, zoom
const SPEEDS = [
  { id: "fine", name: "Fine", k: 0.3 },
  { id: "normal", name: "Normal", k: 1 },
  { id: "fast", name: "Fast", k: 3 },
] as const;
const RATE = 60;

export function PhoneRemote({ room }: { room: string }) {
  const [started, setStarted] = useState(false);
  const [motion, setMotion] = useState<"unknown" | "granted" | "denied">("unknown");
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [deskAt, setDeskAt] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("normal");
  const speedRef = useRef(1);
  speedRef.current = SPEEDS.find((s) => s.id === speed)!.k;
  const held = useRef<[number, number, number, number]>([0, 0, 0, 0]);
  const seq = useRef(0);
  const lastSent = useRef(0);
  const lastO = useRef<{ a: number; b: number; g: number } | null>(null);

  const link = useLink(started ? room : null, "phone", (m) => {
    if (m.k === "ping") link.send({ k: "pong", id: m.id, t0: m.t0, tp: nowMs() });
    else if (m.k === "state") { setDesk(m.s); setDeskAt(Date.now()); }
  });
  const sendRef = useRef(link.send);
  sendRef.current = link.send;
  const cmd = (c: PhoneCmd) => sendRef.current({ k: "cmd", c });

  const sendPose = (force: boolean) => {
    const o = lastO.current;
    if (!o) return;
    const t = nowMs();
    if (!force && t - lastSent.current < 1000 / RATE - 1) return;
    lastSent.current = t;
    const k = speedRef.current;
    const h = held.current;
    const m = h.some((v) => v !== 0) ? (h.map((v) => v * k) as [number, number, number, number]) : undefined;
    const angle = (typeof screen !== "undefined" && screen.orientation?.angle) || 0;
    sendRef.current({ k: "pose", p: { ...o, o: angle, t, n: ++seq.current, ...(m ? { m } : {}) } });
  };
  const sendPoseRef = useRef(sendPose);
  sendPoseRef.current = sendPose;

  useEffect(() => {
    if (!started || motion !== "granted") return;
    const onO = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      lastO.current = { a: e.alpha, b: e.beta, g: e.gamma };
      sendPoseRef.current(false);
    };
    window.addEventListener("deviceorientation", onO);
    // A phone held still may stop reporting; the thumb controls must still move.
    const keep = setInterval(() => { if (nowMs() - lastSent.current > 90) sendPoseRef.current(true); }, 50);
    return () => { window.removeEventListener("deviceorientation", onO); clearInterval(keep); };
  }, [started, motion]);

  // Keep the screen awake while it is the camera.
  useEffect(() => {
    if (!started) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (k: string) => Promise<{ release: () => Promise<void> }> } };
    const get = () => void nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    get();
    const vis = () => { if (document.visibilityState === "visible") get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release(); };
  }, [started]);

  // Desk state goes stale if the computer disappears.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    try {
      const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
      // iPhone answers granted or denied; Chrome may answer "prompt" and still
      // send motion, so only an explicit refusal counts as one.
      setMotion(req && (await req()) === "denied" ? "denied" : "granted");
    } catch {
      setMotion("denied");
    }
    setStarted(true);
  };

  const hold = (axis: Axis, v: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      held.current[axis] = v;
      sendPose(true);
    },
    onPointerUp: () => { held.current[axis] = 0; sendPose(true); },
    onPointerCancel: () => { held.current[axis] = 0; sendPose(true); },
    onLostPointerCapture: () => { held.current[axis] = 0; },
  });

  if (!started) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Phone camera</h1>
          <p className="max-w-[320px] text-[15px] leading-relaxed text-white/70">
            Your phone becomes the camera in shot blocking. Turn it to aim; use the thumb controls to push in, truck, boom and zoom. Watch the shot on the computer.
          </p>
          <button className="rounded-xl bg-accent px-10 py-4 text-lg font-bold text-white" onClick={() => void start()}>
            Start
          </button>
          <p className="max-w-[300px] text-[12.5px] text-white/50">Allow motion access when asked. Hold the phone the way you would hold the camera.</p>
        </div>
      </Shell>
    );
  }

  const deskLive = desk && Date.now() - deskAt < 2000;
  const mode = deskLive ? desk!.mode : null;
  const recording = mode === "rec";
  const counting = mode === "count";

  return (
    <Shell>
      {motion === "denied" && (
        <p className="bg-white/10 px-4 py-2 text-center text-[13px]">
          Motion access was refused, so turning the phone does nothing. Close this tab, open the link again and allow it.
        </p>
      )}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[12.5px] text-white/70">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: `var(--h-${deskLive ? "green" : link.status === "error" ? "red" : "amber"})` }} />
          {deskLive ? `Connected${link.transport === "direct" ? ", direct" : ""}` : link.status === "error" ? link.error ?? "Could not connect" : "Looking for the computer…"}
        </span>
        <span>
          {mode === "drive" ? "You are the camera" : mode === "view" ? "Showing the recorded move" : ""}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap content-center items-center justify-around gap-x-3 gap-y-5 p-3 landscape:flex-nowrap landscape:justify-between">
        {/* Move: push and truck */}
        <Pad
          label="Move"
          up={{ label: "Push in", ...hold(2, 1) }}
          down={{ label: "Pull out", ...hold(2, -1) }}
          left={{ label: "Truck left", ...hold(0, -1) }}
          right={{ label: "Truck right", ...hold(0, 1) }}
        />

        <div className="order-first flex w-full flex-col items-center gap-3 landscape:order-none landscape:w-auto">
          {counting ? (
            <span className="font-display text-7xl font-bold">{Math.max(1, Math.ceil(desk!.sec ?? 0))}</span>
          ) : recording ? (
            <span className="flex items-center gap-2 font-mono text-2xl font-bold">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red" />
              {(desk!.sec ?? 0).toFixed(1)}s
            </span>
          ) : desk?.line && deskLive ? (
            <span className="max-w-[260px] text-center text-[13px] text-white/80">{desk.line}</span>
          ) : null}
          <button
            disabled={!deskLive}
            onClick={() => cmd(recording || counting ? "stop" : "record")}
            className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-40 ${recording || counting ? "bg-transparent" : "bg-red"}`}
            aria-label={recording || counting ? "Stop the take" : "Record a take"}
          >
            {recording || counting ? <span className="h-7 w-7 rounded-[4px] bg-red" /> : null}
          </button>
          <span className="text-[12px] text-white/60">{recording || counting ? "Stop" : "Record a take"}</span>
          <div className="flex gap-2">
            <SmallBtn onClick={() => cmd("key")} disabled={!deskLive || mode !== "drive"}>Set keyframe</SmallBtn>
            <SmallBtn onClick={() => cmd("recentre")} disabled={!deskLive}>Recentre</SmallBtn>
            {mode === "view" && <SmallBtn onClick={() => cmd("drive")}>Take the camera</SmallBtn>}
          </div>
          <div className="flex gap-1 rounded-lg bg-white/10 p-1">
            {SPEEDS.map((s) => (
              <button key={s.id} onClick={() => setSpeed(s.id)}
                className={`rounded-md px-3 py-1 text-[12.5px] font-semibold ${speed === s.id ? "bg-white text-black" : "text-white/70"}`}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Boom and zoom */}
        <Pad
          label="Height and lens"
          up={{ label: "Boom up", ...hold(1, 1) }}
          down={{ label: "Boom down", ...hold(1, -1) }}
          left={{ label: "Zoom out", ...hold(3, -1) }}
          right={{ label: "Zoom in", ...hold(3, 1) }}
        />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="flex min-h-[100dvh] select-none flex-col bg-black text-white" style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}

function SmallBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className="rounded-lg border border-white/30 px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40">{children}</button>;
}

type HoldProps = { label: string } & Record<string, unknown>;

/** Four hold-to-move buttons round a hub, like a games controller's pad. */
function Pad({ label, up, down, left, right }: { label: string; up: HoldProps; down: HoldProps; left: HoldProps; right: HoldProps }) {
  const b = (p: HoldProps, cls: string, glyph: string) => {
    const { label: l, ...h } = p;
    return (
      <button type="button" aria-label={l} {...h}
        className={`flex h-[54px] w-[54px] flex-col landscape:h-[62px] landscape:w-[62px] items-center justify-center rounded-2xl bg-white/10 text-[10.5px] font-semibold leading-tight text-white/85 active:bg-white/30 ${cls}`}>
        <span className="text-xl leading-none">{glyph}</span>
        <span className="mt-0.5 px-1 text-center">{l}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-col items-center">
      <span className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">{label}</span>
      <div className="grid grid-cols-3 grid-rows-3 gap-1 landscape:gap-1.5">
        <span />
        {b(up, "", "↑")}
        <span />
        {b(left, "", "←")}
        <span className="h-[54px] w-[54px] rounded-full landscape:h-[62px] landscape:w-[62px] border border-white/15" />
        {b(right, "", "→")}
        <span />
        {b(down, "", "↓")}
        <span />
      </div>
    </div>
  );
}
