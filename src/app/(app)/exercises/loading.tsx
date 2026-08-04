import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage className="mx-auto max-w-5xl">
      <SkeletonLine className="h-9 w-44" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="h-44" />
        ))}
      </div>
    </SkeletonPage>
  );
}
