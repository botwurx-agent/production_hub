"use client";

import { createContext, useContext } from "react";

// Whether an AI provider key is set on the server. Resolved once in the app
// layout (aiConfigured() is server-only) and read by any client component that
// offers AI help, so a deployment without a key simply never shows those
// controls instead of threading a prop through every page that has a composer.
const AiAvailabilityContext = createContext(false);

export function AiAvailabilityProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <AiAvailabilityContext.Provider value={enabled}>
      {children}
    </AiAvailabilityContext.Provider>
  );
}

export function useAiEnabled(): boolean {
  return useContext(AiAvailabilityContext);
}
