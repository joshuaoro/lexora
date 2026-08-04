import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-9 w-56" />
      <SkeletonCard className="mt-6 h-96" />
    </SkeletonPage>
  );
}
