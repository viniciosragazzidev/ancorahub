export function shouldRequireBrokerAvailabilityOnboarding(status: string | null | undefined) {
  return status !== "completed" && status !== "skipped";
}
