"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Drawing, Stroke } from "@/lib/review-drawing";

// Draw / replay layer that sits exactly over the media box. Two modes:
// - replay (active=false): renders a saved drawing, ignores pointer events, so
//   the video underneath stays clickable.
// - draw (active=true): captures freehand strokes in normalized coords.
export function DrawCanvas({
  drawing,
  active = false,
  color = "#ff3b30",
  size = 4,
  onChange,
}: {
  drawing: Drawing | null;
  active?: boolean;
  color?: string;
  size?: number;
  onChange?: (d: Drawing | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Drawing | null>(drawing);
  const strokeRef = useRef<Stroke | null>(null);

  drawingRef.current = drawing;

  const paint = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { width, height } = cv;
    ctx.clearRect(0, 0, width, height);
    const all = [
      ...(drawingRef.current?.strokes ?? []),
      ...(strokeRef.current ? [strokeRef.current] : []),
    ];
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.strokeStyle = s.color;
      // Scale the line with the box so a drawing keeps its weight when the
      // player is resized or goes fullscreen.
      ctx.lineWidth = Math.max(1.5, (s.size * width) / 900);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p[0] * width;
        const y = p[1] * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (s.points.length === 1) {
        // A tap still leaves a visible dot.
        ctx.lineTo(s.points[0][0] * width + 0.1, s.points[0][1] * height);
      }
      ctx.stroke();
    }
  }, []);

  // Keep the backing store matched to the displayed size so strokes stay sharp.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      paint();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    paint();
  }, [drawing, paint]);

  function pointFrom(e: React.PointerEvent): [number, number] {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }

  function down(e: React.PointerEvent) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    strokeRef.current = { color, size, points: [pointFrom(e)] };
    paint();
  }
  function move(e: React.PointerEvent) {
    if (!active || !strokeRef.current) return;
    e.preventDefault();
    strokeRef.current.points.push(pointFrom(e));
    paint();
  }
  function up() {
    if (!active || !strokeRef.current) return;
    const cv = canvasRef.current;
    const next: Drawing = {
      w: cv?.width ?? 16,
      h: cv?.height ?? 9,
      strokes: [
        ...(drawingRef.current?.strokes ?? []),
        strokeRef.current,
      ],
    };
    strokeRef.current = null;
    onChange?.(next);
    paint();
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      className={`absolute inset-0 h-full w-full ${
        active ? "z-20 cursor-crosshair" : "pointer-events-none z-10"
      }`}
    />
  );
}
