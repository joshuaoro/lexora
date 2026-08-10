import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonLine className="h-9 w-96" />
      <SkeletonLine className="mt-3 h-4 w-full max-w-3xl" />
      <SkeletonCard className="mt-6 h-24" />
      <SkeletonCard className="mt-5 h-64" />
      <SkeletonCard className="mt-5 h-48" />
    </SkeletonPage>
  );
}
