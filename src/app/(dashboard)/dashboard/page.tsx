import NocDashboardContent from "./_components/noc-dashboard-content";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getBrokerDashboardData, getDirectorDashboardData, getManagerDashboardData } from "./data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "director") {
    const data = await getDirectorDashboardData();
    return <NocDashboardContent role="director" data={data} />;
  }
  if (context.role === "manager") {
    return <NocDashboardContent role="manager" data={await getManagerDashboardData()} />;
  }
  return <NocDashboardContent role="broker" data={await getBrokerDashboardData()} />;
}
