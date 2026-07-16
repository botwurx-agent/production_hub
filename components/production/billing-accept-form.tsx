"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptBillingDoc } from "@/app/p/[token]/actions";

export function BillingAcceptForm({
  token,
  defaultName,
  docLabel,
}: {
  token: string;
  defaultName: string | null;
  docLabel: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  // Prepare the canvas (crisp on high-DPI, transparent background).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "drawn") return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1a1c1f";
    }
    hasDrawn.current = false;
  }, [mode]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d");
    const p = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    const p = pos(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
    hasDrawn.current = true;
  }
  function up() {
    drawing.current = false;
  }
  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  }

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Type your name to sign.");
    let signatureData = name.trim();
    if (mode === "drawn") {
      if (!hasDrawn.current) return setError("Draw your signature above.");
      const url = canvasRef.current?.toDataURL("image/png");
      if (!url) return setError("Could not read the signature. Try typing instead.");
      signatureData = url;
    }
    start(async () => {
      const res = await acceptBillingDoc(token, {
        signerName: name.trim(),
        signerEmail: email || null,
        signatureKind: mode,
        signatureData,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const tab =
    "flex-1 rounded-[9px] px-3 py-1.5 text-sm font-semibold transition";

  return (
    <div className="mt-6 rounded-[16px] border border-border bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-text">
        Accept this {docLabel.toLowerCase()}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Sign below to accept. Your signature, name, and the date are recorded.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-text-muted">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-[10px] border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-text-muted">
            Email <span className="text-text-faint">(optional)</span>
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@company.com"
            className="mt-1 w-full rounded-[10px] border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex gap-2 rounded-[11px] bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setMode("typed")}
            className={`${tab} ${mode === "typed" ? "bg-surface text-text shadow-sm" : "text-text-muted"}`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => setMode("drawn")}
            className={`${tab} ${mode === "drawn" ? "bg-surface text-text shadow-sm" : "text-text-muted"}`}
          >
            Draw
          </button>
        </div>

        {mode === "typed" ? (
          <div className="grid h-24 place-items-center rounded-[11px] border border-border bg-surface-2/40">
            <span className="font-display text-3xl italic text-text">
              {name.trim() || "Your signature"}
            </span>
          </div>
        ) : (
          <div className="relative">
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              className="h-24 w-full touch-none rounded-[11px] border border-border bg-surface-2/40"
            />
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute right-2 top-2 rounded-[8px] bg-surface px-2 py-1 text-xs font-semibold text-text-muted shadow-sm transition hover:text-text"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-4 w-full rounded-[11px] bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Recording..." : `Sign & accept ${docLabel.toLowerCase()}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-text-faint">
        By signing you agree this is your electronic signature accepting this{" "}
        {docLabel.toLowerCase()}.
      </p>
    </div>
  );
}
