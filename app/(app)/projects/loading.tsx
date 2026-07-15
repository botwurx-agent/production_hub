import { Skeleton, HeaderSkeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div>
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
