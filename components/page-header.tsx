import type { ReactNode } from "react";
import { IconTile } from "@/components/ui/icon-tile";

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
  hue = "indigo",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  // Optional colored icon tile for page identity (wayfinding, not status).
  icon?: ReactNode;
  hue?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {icon && (
            <IconTile hue={hue} size="lg">
              {icon}
            </IconTile>
          )}
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {/* Quiet gradient accent ties every page top to the brand. */}
      <div
        className="mt-4 h-[3px] w-full rounded-pill opacity-80"
        style={{
          background: `linear-gradient(90deg, var(--h-${hue}), transparent 55%)`,
        }}
      />
    </div>
  );
}
