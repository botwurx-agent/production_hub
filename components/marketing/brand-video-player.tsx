"use client";

import { useEffect, useRef, useState } from "react";
import { BrandVideo, H, VIDEO_MS, W } from "./brand-video";
import { JOURNEY_MS, JourneyVideo } from "./journey-video";

const FILMS = {
  launch: { C: BrandVideo, ms: VIDEO_MS },
  journey: { C: JourneyVideo, ms: JOURNEY_MS },
};

declare global {
  interface Window {
    __BV?: { duration: number; set: (t: number) => Promise<void> };
  }
}

/**
 * Preview and render harness for the launch video.
 * - default: plays in a loop, scaled to fit, with a scrubber.
 * - ?capture=1: native 1080x1920, no chrome, and window.__BV.set(t) resolves
 *   once that frame has painted, which is what the renderer steps through.
 * - ?t=12000: one frozen frame, for stills and the cover image.
 */
export function BrandVideoPlayer({ capture, fixed, film = "launch" }: { capture: boolean; fixed: number | null; film?: keyof typeof FILMS }) {
  const { C: Film, ms: DURATION } = FILMS[film];
  const [t, setT] = useState(fixed ?? 0);
  const [playing, setPlaying] = useState(!capture && fixed === null);
  const resolvers = useRef<(() => void)[]>([]);
  // Bumped on every set, so asking for the frame already on screen still
  // re-renders and resolves (setting the same t is a no-op for React).
  const [frame, setFrame] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!capture) return;
    window.__BV = {
      duration: DURATION,
      set: (v: number) =>
        new Promise<void>((resolve) => {
          resolvers.current.push(resolve);
          setT(v);
          setFrame((f) => f + 1);
        }),
    };
  }, [capture, DURATION]);

  // Resolve pending sets after the frame with the new t has painted.
  useEffect(() => {
    if (!resolvers.current.length) return;
    const done = resolvers.current.splice(0);
    requestAnimationFrame(() => requestAnimationFrame(() => done.forEach((r) => r())));
  }, [t, frame]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setT((v) => (v + (now - last)) % DURATION);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, DURATION]);

  useEffect(() => {
    if (capture) return;
    const fit = () => setScale(Math.min((window.innerHeight - 90) / H, (window.innerWidth - 32) / W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [capture]);

  if (capture) return <Film t={t} />;

  return (
    <div style={{ minHeight: "100vh", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ width: W * scale, height: H * scale, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <Film t={t} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: Math.max(320, W * scale), color: "#ddd", fontSize: 13, fontFamily: "system-ui" }}>
        <button onClick={() => setPlaying((p) => !p)} style={{ padding: "6px 14px", borderRadius: 8, background: "#333", color: "white" }}>
          {playing ? "Pause" : "Play"}
        </button>
        <input type="range" min={0} max={DURATION} value={Math.round(t)} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} style={{ flex: 1 }} />
        <span style={{ width: 70, textAlign: "right" }}>{(t / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
