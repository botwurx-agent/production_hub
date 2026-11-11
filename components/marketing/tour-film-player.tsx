"use client";

import { useEffect, useRef, useState } from "react";
import { TOUR_MS, TourFilm } from "./tour-film";
import { H, W, type Takes } from "./tour-kit";

declare global {
  interface Window {
    __TF?: { duration: number; ready: boolean; set: (t: number) => Promise<void> };
  }
}

/** Every footage image on screen has to be decoded before a frame is taken. */
async function settle() {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-film="1"]'));
  // decode() waits for the load as well, and rejects only on a broken file.
  await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
}

/**
 * Preview and render harness for the tour film. Same contract as the brand
 * video player, plus footage: in capture mode a frame only resolves once
 * its pictures have decoded.
 */
export function TourFilmPlayer({ capture, fixed, takes }: { capture: boolean; fixed: number | null; takes: Takes }) {
  const [t, setT] = useState(fixed ?? 0);
  const [playing, setPlaying] = useState(!capture && fixed === null);
  const [frame, setFrame] = useState(0);
  const [scale, setScale] = useState(1);
  const resolvers = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!capture) return;
    window.__TF = {
      duration: TOUR_MS,
      ready: true,
      set: (v: number) =>
        new Promise<void>((resolve) => {
          resolvers.current.push(resolve);
          setT(v);
          setFrame((f) => f + 1);
        }),
    };
  }, [capture]);

  useEffect(() => {
    if (!resolvers.current.length) return;
    const done = resolvers.current.splice(0);
    requestAnimationFrame(() =>
      settle().then(() => requestAnimationFrame(() => requestAnimationFrame(() => done.forEach((r) => r())))),
    );
  }, [t, frame]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setT((v) => (v + (now - last)) % TOUR_MS);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (capture) return;
    const fit = () => setScale(Math.min((window.innerHeight - 90) / H, (window.innerWidth - 32) / W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [capture]);

  if (capture) return <TourFilm t={t} takes={takes} />;

  return (
    <div style={{ minHeight: "100vh", background: "#111", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ width: W * scale, height: H * scale, overflow: "hidden", borderRadius: 12 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <TourFilm t={t} takes={takes} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: Math.max(320, W * scale), color: "#ddd", fontSize: 13, fontFamily: "system-ui" }}>
        <button onClick={() => setPlaying((p) => !p)} style={{ padding: "6px 14px", borderRadius: 8, background: "#333", color: "white" }}>
          {playing ? "Pause" : "Play"}
        </button>
        <input type="range" min={0} max={TOUR_MS} value={Math.round(t)} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} style={{ flex: 1 }} />
        <span style={{ width: 70, textAlign: "right" }}>{(t / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
