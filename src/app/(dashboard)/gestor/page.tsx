import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getManagerDashboardData } from "@/app/(dashboard)/dashboard/data";
import NocDashboardContent from "@/app/(dashboard)/dashboard/_components/noc-dashboard-content";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage() {
  const context = await getRequiredTenantContext();

  // Apenas gestores podem acessar esta rota
  if (context.role !== "manager") {
    redirect("/dashboard");
  }

  return <NocDashboardContent role="manager" data={await getManagerDashboardData()} />;
}
