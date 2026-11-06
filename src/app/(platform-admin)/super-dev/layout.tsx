import { redirect } from "next/navigation";

import { SuperDevShell } from "@/components/super-dev-shell";
import { AuthenticationError, AuthorizationError, SecondFactorRequiredError } from "@/shared/auth/errors";
import { getRequiredPlatformAdmin, PLATFORM_ADMIN_2FA_SETUP_PATH } from "@/shared/auth/platform-admin";

export default async function SuperDevLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    await getRequiredPlatformAdmin();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/admin/login");
    if (error instanceof SecondFactorRequiredError) redirect(PLATFORM_ADMIN_2FA_SETUP_PATH);
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }

  return <SuperDevShell>{children}</SuperDevShell>;
}
