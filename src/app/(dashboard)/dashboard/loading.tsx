import { ShimmerSkeleton } from "@/components/unlumen-ui/shimmer-skeleton";

export default function DashboardLoading() {
  return <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-4 lg:p-6"><div className="space-y-2"><ShimmerSkeleton className="h-3 w-24" /><ShimmerSkeleton className="h-8 w-52" /><ShimmerSkeleton className="h-4 w-96 max-w-full" /></div><ShimmerSkeleton className="h-36 w-full" rounded="lg" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <ShimmerSkeleton className="h-28" key={index} rounded="lg" />)}</div><div className="grid gap-5 xl:grid-cols-2"><ShimmerSkeleton className="h-96" rounded="lg" /><ShimmerSkeleton className="h-96" rounded="lg" /></div></main>;
}
