import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

/** The heaviest page in the app: several panels, each with its own query. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-4 w-32" />
      <SkeletonLine className="mt-3 h-9 w-64" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      <SkeletonCard className="mt-5 h-64" />
      <SkeletonCard className="mt-5 h-72" />
      <SkeletonCard className="mt-5 h-56" />
    </SkeletonPage>
  );
}
