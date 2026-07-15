"use client";

import { useEffect, useState } from "react";

// Minimal, dependency-free toast. A module-level pub/sub lets any client code
// call toast(...) without threading a provider; <Toaster/> is mounted once in
// the app shell and renders the stack. Used to surface server-action failures
// that would otherwise fail silently.

export type ToastVariant = "error" | "success" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

const listeners = new Set<(t: ToastItem) => void>();
let nextId = 1;

export function toast(message: string, variant: ToastVariant = "info") {
  const item = { id: nextId++, message, variant };
  listeners.forEach((fn) => fn(item));
}

const styles: Record<ToastVariant, string> = {
  error: "border-red/40 bg-red-bg text-red",
  success: "border-green/40 bg-green-bg text-green",
  info: "border-border-strong bg-surface text-text",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 4500);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-[11px] border px-4 py-3 text-sm font-medium shadow-lg ${styles[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
