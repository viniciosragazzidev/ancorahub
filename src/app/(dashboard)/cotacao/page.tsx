import { redirect } from "next/navigation";

import { LightQuoteSimulator } from "@/features/broker-workspace/components/light-quote-simulator";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function QuoteSimulatorPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/access-denied");
  return <LightQuoteSimulator />;
}
