"use client";

import { useEffect, useRef, useState } from "react";

// Voice input for the composer.
//
// Uses the browser's own speech recognition rather than shipping audio
// anywhere: nothing is uploaded, nothing is stored, and it costs nothing.
// Chrome and Edge implement it, Safari partially, Firefox not at all, so the
// button hides itself where it is unsupported instead of offering something
// that does nothing.
//
// This is the case the assistant is actually best at: hands full on a scout or
// a set, saying "log two and a half thousand to the CGI vendor, due Friday"
// rather than opening a page and filling a modal.

type SpeechResultList = {
  length: number;
  item(i: number): { 0: { transcript: string }; isFinal: boolean };
  [index: number]: { 0: { transcript: string }; isFinal: boolean };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Dictation({ onText }: { onText: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(speechCtor()));
    return () => {
      recRef.current?.stop();
    };
  }, []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = speechCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    // Interim results are dropped on purpose: appending them would make the
    // box flicker and rewrite itself while someone is still talking.
    rec.interimResults = false;

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) text += result[0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) onText(trimmed);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  if (!supported) return <span />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      className={`flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs font-medium ${
        listening
          ? "bg-red-bg text-red"
          : "text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <MicIcon />
      {listening ? "Listening" : "Speak"}
    </button>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
