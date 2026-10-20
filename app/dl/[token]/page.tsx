import type { Metadata } from "next";
import { loadDeliveryByToken, recordDeliveryView } from "@/lib/delivery-links";
import { DeliveryClientView } from "@/components/production/delivery-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Your deliverables",
};

/** The client's no-login download page for a project's final deliverables. */
export default async function DeliveryLinkPage({ params }: { params: { token: string } }) {
  const view = await loadDeliveryByToken(params.token);
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
  void recordDeliveryView(params.token).catch(() => {});
  return <DeliveryClientView view={view} token={params.token} />;
}
