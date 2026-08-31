"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The client half of <DemoVideo>: just the bit that needs to know whether this
 * visitor wants motion.
 *
 * A muted looping autoplay video is the convention for a product demo, and it
 * is also exactly what someone with vestibular sensitivity has asked the OS to
 * spare them. `prefers-reduced-motion` cannot stop an autoplay attribute from
 * CSS, so the decision has to happen in JS: reduced motion gets the poster
 * frame and a play control, everyone else gets the loop.
 *
 * `playsInline` is not optional. Without it iOS takes any playing video
 * fullscreen, which on a marketing page means scrolling past a section and
 * having the phone hijacked.
 */
export function DemoPlayer({
  mp4,
  webm,
  poster,
  alt,
}: {
  mp4?: string;
  webm?: string;
  poster?: string;
  alt: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Start still. The effect turns motion on for everyone who has not asked for
  // less, which is the safe default in the half-second before it runs.
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotion(!mq.matches);
    const onChange = () => setMotion(!mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (motion) void v.play().catch(() => {});
    else v.pause();
  }, [motion]);

  return (
    <div className="relative">
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={alt}
        className="block w-full"
      >
        {mp4 ? <source src={mp4} type="video/mp4" /> : null}
        {webm ? <source src={webm} type="video/webm" /> : null}
      </video>

      {!motion ? (
        <button
          type="button"
          onClick={() => void ref.current?.play()}
          className="absolute inset-0 grid place-items-center bg-black/20 transition hover:bg-black/30"
          aria-label={`Play: ${alt}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-surface shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1 text-text">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      ) : null}
    </div>
  );
}
