import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[16px] border border-border bg-surface shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export type HowItWorksStep = {
  icon?: ReactNode;
  title: string;
  text: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  steps,
  hue = "indigo",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  // Optional "here's how it works" explainer, shown beneath the main prompt.
  steps?: HowItWorksStep[];
  // Quiet accent hue for the icon chip (maps to a --h-* token).
  hue?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      {icon && (
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-[16px]"
          style={{
            backgroundColor: `var(--h-${hue}-bg)`,
            color: `var(--h-${hue})`,
          }}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-text">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}

      {steps && steps.length > 0 && (
        <div className="mt-10 w-full max-w-2xl border-t border-border pt-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-wide text-text-faint">
            Here&apos;s how it works
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div
                  className="mb-3 grid h-9 w-9 place-items-center rounded-[11px] text-sm font-bold"
                  style={{
                    backgroundColor: `var(--h-${hue}-bg)`,
                    color: `var(--h-${hue})`,
                  }}
                >
                  {s.icon ?? i + 1}
                </div>
                <p className="text-sm font-bold text-text">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
