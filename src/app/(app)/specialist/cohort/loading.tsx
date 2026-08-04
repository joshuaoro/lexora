import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-4 w-24" />
      <SkeletonLine className="mt-3 h-9 w-80" />
      <SkeletonCard className="mt-6 h-56" />
      <SkeletonCard className="mt-5 h-64" />
    </SkeletonPage>
  );
}
