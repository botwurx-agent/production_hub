import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectHubLoading() {
  return (
    <div>
      {/* Hero */}
      <Skeleton className="h-40 w-full rounded-[16px]" />
      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      {/* Module cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}
