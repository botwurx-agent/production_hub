"use client";

// Latency test for "the phone is the camera" in shot blocking. Two halves on
// one page: the DESK (a 3D view the phone aims, plus the delay numbers) and
// the PHONE (opened from the desk's QR code, ?room=...). Nothing is saved.
//
// Two transports, because the answer may differ: RELAY is a Supabase Realtime
// broadcast channel (no new infrastructure, but every message goes through a
// server), DIRECT is a WebRTC data channel between the two devices, with the
// relay used only to introduce them. Direct needs both devices able to reach
// each other (same wifi is the normal case); it says so when it cannot.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import {
  clockOffset,
  dropped,
  nowMs,
  quantile,
  roomId,
  verdict,
  type Msg,
  type Pose,
} from "@/lib/phone-cam";

type Transport = "relay" | "direct";
type Channel = ReturnType<ReturnType<typeof createClient>["channel"]>;

const STUN: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** One link to the other device: the relay channel, plus an optional data channel. */
function useLink(room: string | null, me: "phone" | "desk", onMsg: (m: Msg) => void) {
  const [status, setStatus] = useState<"off" | "joining" | "on" | "error">("off");
  const [error, setError] = useState<string | null>(null);
  const [direct, setDirect] = useState<"none" | "connecting" | "open" | "failed">("none");
  const chan = useRef<Channel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const handler = useRef(onMsg);
  handler.current = onMsg;

  const raw = (m: Msg) => {
    void chan.current?.send({ type: "broadcast", event: "m", payload: m });
  };

  const wireDc = (d: RTCDataChannel) => {
    dc.current = d;
    d.onopen = () => setDirect("open");
    d.onclose = () => setDirect((s) => (s === "open" ? "failed" : s));
    d.onmessage = (e) => {
      try {
        handler.current(JSON.parse(String(e.data)) as Msg);
      } catch {
        /* not ours */
      }
    };
  };

  const newPc = () => {
    pc.current?.close();
    const p = new RTCPeerConnection(STUN);
    p.onicecandidate = (e) => {
      if (e.candidate) raw({ k: "signal", to: me === "desk" ? "phone" : "desk", ice: e.candidate.toJSON() });
    };
    p.onconnectionstatechange = () => {
      if (p.connectionState === "failed") setDirect("failed");
    };
    pc.current = p;
    return p;
  };

  const onSignal = async (m: Extract<Msg, { k: "signal" }>) => {
    if (m.to !== me) return;
    try {
      if (m.sdp) {
        const desc = m.sdp as RTCSessionDescriptionInit;
        if (desc.type === "offer") {
          const p = newPc();
          p.ondatachannel = (e) => wireDc(e.channel);
          setDirect("connecting");
          await p.setRemoteDescription(desc);
          const ans = await p.createAnswer();
          await p.setLocalDescription(ans);
          raw({ k: "signal", to: "desk", sdp: p.localDescription?.toJSON() });
        } else if (pc.current) {
          await pc.current.setRemoteDescription(desc);
        }
      } else if (m.ice && pc.current) {
        await pc.current.addIceCandidate(m.ice as RTCIceCandidateInit);
      }
    } catch {
      setDirect("failed");
    }
  };

  useEffect(() => {
    if (!room) return;
    setStatus("joining");
    const supabase = createClient();
    const c = supabase.channel(`phonecam:${room}`, { config: { broadcast: { self: false, ack: false } } });
    c.on("broadcast", { event: "m" }, ({ payload }) => {
      const m = payload as Msg;
      if (m?.k === "signal") void onSignal(m);
      else handler.current(m);
    });
    c.subscribe((s, err) => {
      if (s === "SUBSCRIBED") {
        setStatus("on");
        raw({ k: "hello", from: me });
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        setStatus("error");
        setError(err?.message || (s === "TIMED_OUT" ? "Timed out joining the relay." : "The relay refused the channel."));
      }
    });
    chan.current = c;
    return () => {
      void supabase.removeChannel(c);
      pc.current?.close();
      chan.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, me]);

  const goDirect = async () => {
    const p = newPc();
    wireDc(p.createDataChannel("pose", { ordered: false, maxRetransmits: 0 }));
    setDirect("connecting");
    const offer = await p.createOffer();
    await p.setLocalDescription(offer);
    raw({ k: "signal", to: "phone", sdp: p.localDescription?.toJSON() });
    setTimeout(() => setDirect((s) => (s === "connecting" ? "failed" : s)), 10000);
  };

  const dropDirect = () => {
    pc.current?.close();
    pc.current = null;
    dc.current = null;
    setDirect("none");
  };

  /** Sends over the direct channel when it is open, else the relay. */
  const send = (m: Msg) => {
    const d = dc.current;
    if (d && d.readyState === "open") {
      try {
        d.send(JSON.stringify(m));
        return;
      } catch {
        /* fall through */
      }
    }
    raw(m);
  };

  const transport: Transport = direct === "open" ? "direct" : "relay";
  return { status, error, direct, transport, send, goDirect, dropDirect };
}

// ---------------------------------------------------------------- DESK

function poseQuat(p: Pose, yaw0: number, out: THREE.Quaternion) {
  const d = Math.PI / 180;
  const euler = new THREE.Euler((p.b || 0) * d, ((p.a || 0) - yaw0) * d, -(p.g || 0) * d, "YXZ");
  out.setFromEuler(euler);
  out.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
  out.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(p.o || 0) * d));
  return out;
}

function Desk() {
  const room = useMemo(() => roomId(), []);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const host = useRef<HTMLDivElement>(null);

  const latest = useRef<Pose | null>(null);
  const yaw0 = useRef(0);
  const ages = useRef<number[]>([]);
  const gaps = useRef<number[]>([]);
  const seqs = useRef<number[]>([]);
  const lastArrive = useRef<number | null>(null);
  const pings = useRef<{ t0: number; tp: number; t3: number }[]>([]);
  const offset = useRef<{ offset: number; rtt: number } | null>(null);
  const arrivals = useRef<number[]>([]);
  const [phoneSeen, setPhoneSeen] = useState(false);
  const [view, setView] = useState({
    p50: null as number | null,
    p95: null as number | null,
    rtt: null as number | null,
    rate: 0,
    stutter: null as number | null,
    drops: 0,
    samples: 0,
  });

  const reset = () => {
    ages.current = [];
    gaps.current = [];
    seqs.current = [];
    pings.current = [];
    offset.current = null;
    arrivals.current = [];
    lastArrive.current = null;
  };

  const link = useLink(room, "desk", (m) => {
    const now = nowMs();
    if (m.k === "hello" && m.from === "phone") setPhoneSeen(true);
    if (m.k === "pong") {
      pings.current = [...pings.current.slice(-39), { t0: m.t0, tp: m.tp, t3: now }];
      offset.current = clockOffset(pings.current);
    }
    if (m.k === "pose") {
      setPhoneSeen(true);
      latest.current = m.p;
      if (lastArrive.current !== null) gaps.current = [...gaps.current.slice(-299), now - lastArrive.current];
      lastArrive.current = now;
      arrivals.current = [...arrivals.current.filter((t) => now - t < 1000), now];
      seqs.current = [...seqs.current.slice(-599), m.p.n];
      if (offset.current) ages.current = [...ages.current.slice(-299), now - (m.p.t - offset.current.offset)];
    }
  });

  // Switching transport starts the numbers again, so they describe one link.
  useEffect(() => {
    reset();
  }, [link.transport]);

  useEffect(() => {
    const u = `${window.location.origin}/dev/phone-cam?room=${room}`;
    setUrl(u);
    void QRCode.toDataURL(u, { margin: 1, width: 240 }).then(setQr);
  }, [room]);

  // Pings every half second, over whichever link is live.
  useEffect(() => {
    if (link.status !== "on") return;
    let id = 0;
    const t = setInterval(() => link.send({ k: "ping", id: ++id, t0: nowMs() }), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.status, link.transport]);

  useEffect(() => {
    const t = setInterval(() => {
      setView({
        p50: quantile(ages.current, 0.5),
        p95: quantile(ages.current, 0.95),
        rtt: quantile(pings.current.map((s) => s.t3 - s.t0), 0.5),
        rate: arrivals.current.filter((x) => nowMs() - x < 1000).length,
        stutter: quantile(gaps.current, 0.95),
        drops: dropped(seqs.current),
        samples: ages.current.length,
      });
    }, 250);
    return () => clearInterval(t);
  }, []);

  // The 3D view the phone aims.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15171c);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 3);
    scene.add(sun);
    scene.add(new THREE.GridHelper(60, 60, 0x556070, 0x2a3038));
    const colors = [0xe46a5a, 0xe8b04a, 0x6fbf73, 0x4fa3d9, 0x9a7be0, 0xdb6fae, 0x5cc7c2, 0xc9c9c9];
    colors.forEach((c, i) => {
      const ang = (i / colors.length) * Math.PI * 2;
      const h = 1 + (i % 3) * 0.9;
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
      m.position.set(Math.sin(ang) * 6, h / 2, -Math.cos(ang) * 6);
      scene.add(m);
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pole.position.set(0, 3, -9);
    scene.add(pole);
    const cam = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    cam.position.set(0, 1.6, 0);
    const q = new THREE.Quaternion();
    let raf = 0;
    const size = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    const tick = () => {
      if (latest.current) cam.quaternion.copy(poseQuat(latest.current, yaw0.current, q));
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  const v = verdict(view.p95);
  const ms = (x: number | null) => (x === null ? "..." : `${Math.round(x)} ms`);

  return (
    <div className="flex h-[100dvh] flex-col gap-4 bg-bg p-4 text-text lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-[340px]">
        <div>
          <h1 className="font-display text-xl font-bold">Phone camera: latency test</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Scan with the phone, press Start there, and move it. Nothing is saved.
          </p>
        </div>

        <div className="rounded-[12px] border border-border bg-surface p-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the phone" className="mx-auto h-[200px] w-[200px] rounded-md bg-white p-1" />
          ) : (
            <div className="mx-auto h-[200px] w-[200px] rounded-md bg-surface-2" />
          )}
          <p className="mt-2 break-all text-center text-[11px] text-text-faint">{url}</p>
          <p className="mt-2 text-center text-[13px]">
            <Dot hue={link.status === "on" ? "green" : link.status === "error" ? "red" : "amber"} />
            Relay {link.status === "on" ? "connected" : link.status}
            {" · "}
            Phone {phoneSeen ? "here" : "not yet"}
          </p>
          {link.error && <p className="mt-1 text-center text-[12px] text-text">{link.error}</p>}
        </div>

        <div className="rounded-[12px] border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Link</span>
            <span className="text-[13px] font-semibold">{link.transport === "direct" ? "Direct (WebRTC)" : "Relay (Supabase)"}</span>
          </div>
          <div className="mt-3 flex gap-2">
            {link.direct === "open" ? (
              <button className="rounded-md border border-border px-3 py-1.5 text-[13px]" onClick={link.dropDirect}>
                Back to relay
              </button>
            ) : (
              <button
                className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
                disabled={!phoneSeen || link.direct === "connecting"}
                onClick={() => void link.goDirect()}
              >
                {link.direct === "connecting" ? "Connecting..." : "Try direct"}
              </button>
            )}
            <button className="rounded-md border border-border px-3 py-1.5 text-[13px]" onClick={() => (yaw0.current = latest.current?.a ?? 0)}>
              Recentre
            </button>
          </div>
          {link.direct === "failed" && (
            <p className="mt-2 text-[12px] text-text-muted">
              Direct did not connect. Usually the two devices cannot reach each other (different networks, or a strict
              router). Put both on the same wifi and try again.
            </p>
          )}
        </div>

        <div className="rounded-[12px] border border-border bg-surface p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Pose delay, phone to desk</div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-4xl font-bold tabular-nums">{ms(view.p50)}</span>
            <span className="text-[13px] text-text-muted">typical</span>
          </div>
          <div className="mt-1 text-[14px] tabular-nums">
            {ms(view.p95)} <span className="text-text-muted">worst 1 in 20</span>
          </div>
          {v && (
            <p className="mt-3 text-[14px] font-semibold">
              <Dot hue={v.hue} />
              {v.word}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-[13px]">
            <dt className="text-text-muted">Round trip</dt>
            <dd className="text-right tabular-nums">{ms(view.rtt)}</dd>
            <dt className="text-text-muted">Updates a second</dt>
            <dd className="text-right tabular-nums">{view.rate}</dd>
            <dt className="text-text-muted">Longest gaps (1 in 20)</dt>
            <dd className="text-right tabular-nums">{ms(view.stutter)}</dd>
            <dt className="text-text-muted">Lost updates</dt>
            <dd className="text-right tabular-nums">{view.drops}</dd>
            <dt className="text-text-muted">Samples</dt>
            <dd className="text-right tabular-nums">{view.samples}</dd>
          </dl>
          <p className="mt-3 text-[11.5px] text-text-faint">
            Delay waits for a few pings to line the two clocks up, so it shows a moment after the phone starts. Under 100 ms
            reads as live on camera.
          </p>
        </div>
      </aside>
      <div ref={host} className="relative min-h-[300px] flex-1 overflow-hidden rounded-[12px] border border-border" />
    </div>
  );
}

// ---------------------------------------------------------------- PHONE

function Phone({ room }: { room: string }) {
  const [started, setStarted] = useState(false);
  const [motion, setMotion] = useState<"unknown" | "granted" | "denied">("unknown");
  const [rate, setRate] = useState(60);
  const [sent, setSent] = useState(0);
  const seq = useRef(0);
  const lastSent = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const link = useLink(started ? room : null, "phone", (m) => {
    if (m.k === "ping") link.send({ k: "pong", id: m.id, t0: m.t0, tp: nowMs() });
  });
  const sendRef = useRef(link.send);
  sendRef.current = link.send;

  useEffect(() => {
    if (!started || motion !== "granted") return;
    const onO = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const t = nowMs();
      if (t - lastSent.current < 1000 / rateRef.current - 1) return;
      lastSent.current = t;
      const o = (typeof screen !== "undefined" && screen.orientation?.angle) || 0;
      sendRef.current({ k: "pose", p: { a: e.alpha, b: e.beta, g: e.gamma, o, t, n: ++seq.current } });
    };
    window.addEventListener("deviceorientation", onO);
    const t = setInterval(() => setSent(seq.current), 500);
    return () => {
      window.removeEventListener("deviceorientation", onO);
      clearInterval(t);
    };
  }, [started, motion]);

  // Keep the screen awake while testing.
  useEffect(() => {
    if (!started) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (k: string) => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => void lock?.release();
  }, [started]);

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

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-bg p-6 text-center text-text">
      <h1 className="font-display text-2xl font-bold">Phone camera test</h1>
      {!started ? (
        <>
          <p className="max-w-[300px] text-[15px] text-text-muted">
            Press Start, allow motion access, then aim the phone around. Watch the computer screen.
          </p>
          <div className="flex gap-2">
            {[30, 60].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`rounded-md border px-3 py-1.5 text-[14px] ${rate === r ? "border-accent bg-accent-soft font-semibold" : "border-border"}`}
              >
                {r} a second
              </button>
            ))}
          </div>
          <button className="rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white" onClick={() => void start()}>
            Start
          </button>
        </>
      ) : (
        <div className="space-y-2 text-[15px]">
          <p>
            <Dot hue={link.status === "on" ? "green" : link.status === "error" ? "red" : "amber"} />
            Relay {link.status === "on" ? "connected" : link.status}
          </p>
          <p>Link: {link.transport === "direct" ? "Direct" : "Relay"}</p>
          <p>
            Motion:{" "}
            {motion === "granted" ? "on" : "not allowed. Close the tab, reopen the link and allow motion access."}
          </p>
          <p className="tabular-nums">{sent} updates sent</p>
          {link.error && <p className="text-[13px]">{link.error}</p>}
        </div>
      )}
    </div>
  );
}

function Dot({ hue }: { hue: "green" | "amber" | "red" }) {
  return <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: `var(--h-${hue})` }} />;
}

export function PhoneCamTest({ room }: { room: string | null }) {
  return room ? <Phone room={room} /> : <Desk />;
}
