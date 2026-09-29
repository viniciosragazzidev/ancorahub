import "server-only";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getBrokerAvailabilityProfile, needsBrokerAvailabilityOnboarding } from "../service";
import { BrokerAvailabilityOnboarding } from "./broker-availability-onboarding";

export async function BrokerAvailabilityOnboardingLoader() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || !(await needsBrokerAvailabilityOnboarding(context))) return null;
  const profile = await getBrokerAvailabilityProfile(context);
  return <BrokerAvailabilityOnboarding initialWindows={profile.windows} />;
}
