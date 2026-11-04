"use client";

// Fixture: the real shot blocking editor on a template, with nothing saved.
// ?t=road|city|interior|product|desert|stage picks the template. /dev pages
// are public in development and auth-gated in production.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { BlockScene } from "@/lib/blocking/scene";
import { TEMPLATES } from "@/lib/blocking/templates";
import { BlockingStudio } from "@/components/blocking/blocking-studio";
import { STUDIO_VARS } from "@/components/blocking/ui";

function Inner() {
  const q = useSearchParams();
  const tp = TEMPLATES.find((x) => x.id === q.get("t")) ?? TEMPLATES[0];
  // Made once, in the browser: a template mints fresh ids each time it runs.
  const [scene, setScene] = useState<BlockScene | null>(null);
  useEffect(() => setScene(tp.make()), [tp]);
  if (!scene) return null;
  return (
    <div data-theme="dark" className="fixed inset-0 bg-bg"
      style={STUDIO_VARS}>
      <BlockingStudio initial={scene} canEdit onChange={() => {}} />
    </div>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
