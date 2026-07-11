import type { Metadata } from "next";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { loadSharedBoard } from "@/lib/board-share";
import { PublicBoard } from "@/components/boards/public-board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Shared board",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default async function PublicBoardPage({
  params,
}: {
  params: { token: string };
}) {
  if (!serviceConfigured()) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Board unavailable</h1>
        <p className="mt-2 text-sm text-text-muted">
          This link can&apos;t be opened yet. Please contact the studio.
        </p>
      </Centered>
    );
  }

  const service = createServiceClient();
  const data = await loadSharedBoard(service, params.token);
  if (!data) {
    return (
      <Centered>
        <h1 className="font-display text-xl font-bold text-text">Link not available</h1>
        <p className="mt-2 text-sm text-text-muted">
          This board link is invalid or was turned off. Please ask the studio for a
          new one.
        </p>
      </Centered>
    );
  }

  // The board id isn't needed for editing here, but BoardCanvas expects one.
  return (
    <PublicBoard
      boardId={params.token}
      boardName={data.boardName}
      studioName={data.studioName}
      background={data.background}
      items={data.items}
      connections={data.connections}
    />
  );
}
