import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

function LoadingCard({ className = "" }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-9 w-24" />
      <Skeleton className="mt-3 h-3 w-36" />
    </Card>
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      aria-label="Carregando dashboard"
    >
      <div className="flex flex-col gap-3 border-b border-border/70 pb-6">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-[340px] rounded-xl xl:col-span-8" />
        <Skeleton className="h-[340px] rounded-xl xl:col-span-4" />
      </div>
      <div className="grid gap-5 xl:grid-cols-12">
        <Skeleton className="h-[270px] rounded-xl xl:col-span-8" />
        <Skeleton className="h-[270px] rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}
