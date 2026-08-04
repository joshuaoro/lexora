import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage className="mx-auto max-w-4xl">
      <SkeletonLine className="h-9 w-52" />
      <SkeletonCard className="mt-6 h-80" />
    </SkeletonPage>
  );
}
