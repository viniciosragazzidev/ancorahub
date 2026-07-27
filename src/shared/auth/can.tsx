import type { ReactNode } from "react";

import { hasCapability, type PermissionKey } from "./permissions";
import type { TenantRole } from "@/shared/db/schema";

export function Can({
  role,
  jobTitle,
  permission,
  children,
}: {
  role: TenantRole | string | null | undefined;
  jobTitle?: string | null;
  permission: PermissionKey;
  children: ReactNode;
}) {
  return hasCapability(role, permission, jobTitle) ? children : null;
}
