import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-4 w-28" />
      <SkeletonLine className="mt-3 h-9 w-72" />
      <SkeletonCard className="mt-6 h-80" />
    </SkeletonPage>
  );
}
