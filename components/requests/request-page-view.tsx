import type { ReactNode } from "react";

/**
 * The job request page around its form, presentational so a fixture mounts the
 * real layout. Words on the left (who is being asked, and what happens next),
 * the form on the right; stacked on a phone.
 */
export function RequestPageView({
  studioName,
  logoUrl,
  clientName,
  children,
}: {
  studioName: string;
  logoUrl: string | null;
  clientName: string;
  children: ReactNode;
}) {
  const steps = [
    ["Tell them what you need", "A line for the job, any detail you have, and files if they help."],
    ["It lands with the studio", `${studioName} sees it straight away, with your brief and files attached.`],
    ["They reply by email", "With questions, a quote, or a start date."],
  ];
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <div className="mb-6 flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 rounded-[10px] border border-border bg-surface object-contain"
              />
            ) : null}
            <span className="text-sm font-semibold text-text-muted">{studioName}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            Request new work
          </h1>
          <p className="mt-3 text-[15px] text-text-muted">
            For {clientName}. Send {studioName} the next job and it goes straight
            onto their board. No login needed.
          </p>
          <ol className="mt-8 divide-y divide-border rounded-[14px] border border-border bg-surface">
            {steps.map(([title, body], i) => (
              <li key={title} className="flex gap-3 px-4 py-3.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border-strong text-xs font-bold text-text">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-text">{title}</span>
                  <span className="block text-sm text-text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
