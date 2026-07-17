"use client";

import { useEffect } from "react";

// Fires the browser print dialog once on mount (used when the print view is
// opened with ?auto=1 from a "Download PDF" button, so it's one click).
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
