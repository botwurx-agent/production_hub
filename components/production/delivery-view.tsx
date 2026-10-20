import { fileSize } from "@/lib/format";
import type { DeliveryView } from "@/lib/delivery-links";

/**
 * The client's download page for the final deliverables. Presentational and
 * hook-free, so the public page and a fixture mount the same thing. Each file
 * is a plain link to the token-guarded download route.
 */
export function DeliveryClientView({
  view,
  token,
}: {
  view: DeliveryView;
  token: string;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <div className="mb-6 flex items-center gap-3">
            {view.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.logoUrl}
                alt=""
                className="h-9 w-9 rounded-[10px] border border-border bg-surface object-contain"
              />
            ) : null}
            <span className="text-sm font-semibold text-text-muted">{view.studioName}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            {view.projectTitle}
          </h1>
          <p className="mt-2 text-[15px] text-text-muted">
            {view.clientName ? `For ${view.clientName}. ` : ""}
            The final deliverables from {view.studioName}, ready to download.
          </p>
          {view.fileCount > 0 && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-text">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: "var(--h-green)" }} />
              {view.fileCount} {view.fileCount === 1 ? "file" : "files"} delivered
            </p>
          )}
        </header>

        {view.groups.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-text-muted">
            Nothing has been delivered here yet. {view.studioName} will let you
            know when the files are ready.
          </p>
        ) : (
          <div className="space-y-6">
            {view.groups.map((g, i) => (
              <section key={i} className="rounded-[16px] border border-border bg-surface p-4 sm:p-5">
                <div className="mb-3">
                  <h2 className="text-base font-bold text-text">{g.name ?? "Other files"}</h2>
                  {g.spec && <p className="text-sm text-text-muted">{g.spec}</p>}
                </div>
                <ul className="divide-y divide-border">
                  {g.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-text-muted">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                          <path d="M14 3v5h5" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{f.name}</p>
                        {f.sizeBytes ? (
                          <p className="text-xs text-text-muted">{fileSize(f.sizeBytes)}</p>
                        ) : null}
                      </div>
                      <a
                        href={`/dl/${token}/file/${f.id}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                        </svg>
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
