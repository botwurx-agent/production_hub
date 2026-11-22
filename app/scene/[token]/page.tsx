import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { loadSharedScene } from "@/lib/scene-share";
import { cleanGuestKey } from "@/lib/scene-share-rules";
import { SharedScene } from "@/components/previz/shared-scene";
import { SIGNUP_URL } from "@/lib/marketing/hosts";
import { recordSceneView } from "./actions";

export const dynamic = "force-dynamic";

// A private link, so it stays out of search results even though the token is
// what actually guards it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Shared scene",
};

/**
 * One scene builder setup, opened by link with no account: a DP or a gaffer
 * the producer sent it to. What they may do (look, edit their own copy, or
 * edit the setup itself) is set on the link.
 */
export default async function SharedScenePage({ params }: { params: { token: string } }) {
  const key = cleanGuestKey(cookies().get("sf_rk")?.value);
  const view = serviceConfigured() ? await loadSharedScene(createServiceClient(), params.token, key) : null;
  if (!view) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link is invalid or was turned off. Please ask the studio for a new one.
        </p>
      </div>
    );
  }
  // Best effort: a failed stamp must never fail the page somebody is opening.
  void recordSceneView(params.token).catch(() => {});
  return (
    <SharedScene
      token={params.token}
      mode={view.mode}
      studioName={view.studioName}
      setupName={view.setupName}
      initial={view.setup}
      mine={view.mine ? { name: view.mine.name } : null}
      siteHref="https://studio-flows.com"
      signupHref={SIGNUP_URL}
    />
  );
}
