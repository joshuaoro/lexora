import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage className="mx-auto max-w-5xl">
      <SkeletonLine className="h-9 w-40" />
      <SkeletonCard className="mt-5 h-16" />
      <SkeletonCard className="mt-5 h-96" />
    </SkeletonPage>
  );
}
