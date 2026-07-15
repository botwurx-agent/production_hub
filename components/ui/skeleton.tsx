// Lightweight loading placeholders. Used by route-level loading.tsx files so a
// navigation shows structure immediately instead of a blank blocking wait.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[10px] bg-surface-2 ${className}`}
      aria-hidden
    />
  );
}

// A page-header-shaped placeholder (icon tile + title + subtitle + accent bar).
export function HeaderSkeleton() {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 rounded-[14px]" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <Skeleton className="mt-4 h-[3px] w-full" />
    </div>
  );
}
