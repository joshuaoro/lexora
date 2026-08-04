import { SkeletonPage, SkeletonLine, SkeletonCard } from "@/components/Skeleton";

/** Shaped like the intro card a child is about to see. */
export default function Loading() {
  return (
    <SkeletonPage className="mx-auto max-w-2xl">
      <SkeletonCard className="h-72" />
      <SkeletonLine className="mx-auto mt-6 h-12 w-52" />
    </SkeletonPage>
  );
}
