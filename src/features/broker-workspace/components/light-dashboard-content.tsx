import { LightDashboard, LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { getBrokerWorkspaceData, type BrokerWorkspaceData } from "@/features/broker-workspace/queries";

/** Greeting for the Sao Paulo hour, decided on the server so it matches what the client renders. */
function getGreeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(now),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Loads the broker workspace; a failure shows a retry state instead of breaking the route. */
export async function LightDashboardContent() {
  let data: BrokerWorkspaceData;
  try {
    data = await getBrokerWorkspaceData();
  } catch (error) {
    console.error("[light-dashboard] Could not load the broker workspace", error);
    return <LightDashboardUnavailable />;
  }
  return <LightDashboard data={data} greeting={getGreeting(new Date())} />;
}
