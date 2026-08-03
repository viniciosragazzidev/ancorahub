import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { getManagerDashboardData } from "@/app/(dashboard)/dashboard/data";
import NocDashboardContent from "@/app/(dashboard)/dashboard/_components/noc-dashboard-content";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const period = parsePeriod((await searchParams).period);

  // Apenas gestores podem acessar esta rota
  if (context.role !== "manager") {
    redirect("/dashboard");
  }

  return <NocDashboardContent role="manager" data={await getManagerDashboardData(period)} period={period} />;
}
