"use client";

// The viewfinder is a phone tool: on a computer, the useful thing to show is
// how to get it onto the phone, not a webcam pretending to be a lens.
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Viewfinder } from "./viewfinder";

type Props = React.ComponentProps<typeof Viewfinder>;

export function ViewfinderGate(props: Props) {
  const [mode, setMode] = useState<"unknown" | "phone" | "desktop">("unknown");
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
    setMode(touch ? "phone" : "desktop");
    setUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (mode !== "desktop" || !url) return;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [mode, url]);

  if (mode === "unknown") return <div className="fixed inset-0 z-[70] bg-black" />;
  if (mode === "phone") return <Viewfinder {...props} />;

  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <h1 className="font-display text-2xl font-bold text-text">Open the viewfinder on your phone</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
        It frames a cine lens through your phone&apos;s camera, so it belongs in your hand on the location. Scan this with the phone you will use, signed in to Studio Flows.
      </p>
      <div className="mx-auto mt-6 w-56 rounded-[16px] border border-border bg-[#fff] p-3">
        {qr ? (
          // An SVG we generated from this page's own URL.
          <div aria-label="QR code for this page" dangerouslySetInnerHTML={{ __html: qr }} />
        ) : (
          <div className="aspect-square" />
        )}
      </div>
      <p className="mt-3 break-all text-xs text-text-faint">{url}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold">
        <Link href={props.stillsHref} className="rounded-lg bg-surface-2 px-4 py-2 text-text">See location stills</Link>
        <button type="button" onClick={() => setMode("phone")} className="rounded-lg px-4 py-2 text-text-muted hover:bg-surface-2">
          Use this computer&apos;s camera anyway
        </button>
      </div>
    </div>
  );
}
