import { DashboardHeader } from "@/components/dashboard-header";
import { ShimmerSkeleton } from "@/components/unlumen-ui/shimmer-skeleton";

export default function LeadDetailLoading() {
  return (
    <>
      <DashboardHeader breadcrumb="Operacao comercial" title="Detalhe do lead" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <ShimmerSkeleton className="h-16" rounded="lg" />
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.85fr)]">
          <ShimmerSkeleton className="h-64" rounded="lg" />
          <ShimmerSkeleton className="h-[32rem]" rounded="lg" />
        </section>
      </main>
    </>
  );
}
