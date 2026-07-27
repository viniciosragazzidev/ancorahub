import { redirect } from "next/navigation";

import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";

export default async function PlatformAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try { await getRequiredPlatformAdmin(); } catch (error) {
    if (error instanceof AuthenticationError) redirect("/admin/login");
    if (error instanceof AuthorizationError) redirect("/access-denied");
    throw error;
  }
  return <PlatformAdminShell>{children}</PlatformAdminShell>;
}
