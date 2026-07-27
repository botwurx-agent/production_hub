"use client";

import { useCallback, useEffect, useRef } from "react";
import { isShape, type Drawing, type DrawTool, type Stroke } from "@/lib/review-drawing";

// Draw / replay layer that sits exactly over the media box. Two modes:
// - replay (active=false): renders a saved drawing, ignores pointer events, so
//   the video underneath stays clickable.
// - draw (active=true): captures freehand strokes in normalized coords.
export function DrawCanvas({
  drawing,
  active = false,
  tool = "pen",
  color = "#ff3b30",
  size = 4,
  onChange,
}: {
  drawing: Drawing | null;
  active?: boolean;
  tool?: DrawTool;
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
      const w = Math.max(1.5, (s.size * width) / 900);
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const [ax, ay] = [s.points[0][0] * width, s.points[0][1] * height];
      const last = s.points[s.points.length - 1];
      const [bx, by] = [last[0] * width, last[1] * height];

      if (s.tool === "rect") {
        ctx.beginPath();
        ctx.rect(ax, ay, bx - ax, by - ay);
        ctx.stroke();
        continue;
      }
      if (s.tool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
          (ax + bx) / 2,
          (ay + by) / 2,
          Math.abs(bx - ax) / 2,
          Math.abs(by - ay) / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        continue;
      }
      if (s.tool === "line" || s.tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        if (s.tool === "arrow") {
          // Head scales with the stroke so it stays in proportion at any size.
          const angle = Math.atan2(by - ay, bx - ax);
          const head = Math.max(8, w * 3.5);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(
            bx - head * Math.cos(angle - Math.PI / 7),
            by - head * Math.sin(angle - Math.PI / 7)
          );
          ctx.moveTo(bx, by);
          ctx.lineTo(
            bx - head * Math.cos(angle + Math.PI / 7),
            by - head * Math.sin(angle + Math.PI / 7)
          );
          ctx.stroke();
        }
        continue;
      }

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
    const p = pointFrom(e);
    strokeRef.current = isShape(tool)
      ? { tool, color, size, points: [p, p] }
      : { tool, color, size, points: [p] };
    paint();
  }
  function move(e: React.PointerEvent) {
    if (!active || !strokeRef.current) return;
    e.preventDefault();
    const p = pointFrom(e);
    if (isShape(strokeRef.current.tool)) strokeRef.current.points[1] = p;
    else strokeRef.current.points.push(p);
    paint();
  }
  function up() {
    if (!active || !strokeRef.current) return;
    const st = strokeRef.current;
    if (isShape(st.tool)) {
      const [a, b] = st.points;
      if (Math.abs(a[0] - b[0]) < 0.004 && Math.abs(a[1] - b[1]) < 0.004) {
        strokeRef.current = null;
        paint();
        return;
      }
    }
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
