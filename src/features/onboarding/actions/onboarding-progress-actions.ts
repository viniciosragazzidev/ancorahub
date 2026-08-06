"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getUserTourProgress, updateUserTourProgress, type UserOnboardingStatus } from "../services/onboarding-progress-service";

export async function getUserTourProgressAction(tourKey: string, version = 1) {
  const context = await getRequiredTenantContext();
  return getUserTourProgress(context, tourKey, version);
}

export async function updateUserTourProgressAction(input: {
  tourKey: string;
  version?: number;
  status: UserOnboardingStatus;
  currentStep?: number;
}) {
  const context = await getRequiredTenantContext();
  return updateUserTourProgress(context, input);
}
