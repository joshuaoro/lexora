import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-9 w-64" />
      <SkeletonLine className="mt-2 h-4 w-80" />
      <SkeletonCard className="mt-6 h-72" />
      <SkeletonCard className="mt-5 h-64" />
    </SkeletonPage>
  );
}
