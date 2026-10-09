import { redirect } from "next/navigation";

import { LightQuoteSimulator } from "@/features/broker-workspace/components/light-quote-simulator";
import { QuoteChat } from "@/features/broker-workspace/chat/quote-chat";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

/** Guided quote as a chat (assistant Cotação); ?completo=1 opens the full simulator (filters, network, comparison). */
export default async function QuoteSimulatorPage({ searchParams }: { searchParams: Promise<{ completo?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/access-denied");
  const { completo } = await searchParams;
  // The chat has its own chrome only in the Lite app; the Full mode keeps the simulator.
  const isLite = (await getExperienceMode(context)) === "LIGHT";
  return isLite && completo !== "1" ? <QuoteChat /> : <LightQuoteSimulator />;
}
