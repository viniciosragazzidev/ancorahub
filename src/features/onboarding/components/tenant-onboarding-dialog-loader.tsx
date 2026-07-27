import { TenantOnboardingDialog } from "./tenant-onboarding-dialog"
import { getCurrentTenantOnboarding } from "../queries/get-current-tenant-onboarding"

/**
 * Server component that loads onboarding data and renders the dialog
 * or nothing if the user shouldn't see it.
 */
export async function TenantOnboardingDialogLoader() {
  const onboarding = await getCurrentTenantOnboarding()

  if (!onboarding) {
    return null
  }

  return <TenantOnboardingDialog onboarding={onboarding} />
}
