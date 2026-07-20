import type { Metadata } from "next";
import { serviceConfigured } from "@/lib/supabase/service";
import { loadBatchByToken } from "@/lib/batch-review";
import { BatchReview } from "@/components/review/batch-review";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Review options",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function BatchReviewPortalPage({
  params,
}: {
  params: { token: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Review portal not configured</h1>
        <p className="mt-2 text-sm text-text-muted">
          This review link can&apos;t be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const data = await loadBatchByToken(params.token);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This review link is invalid or was turned off. Please ask the studio for a new one.
        </p>
      </Centered>
    );
  }

  return <BatchReview token={params.token} data={data} />;
}
