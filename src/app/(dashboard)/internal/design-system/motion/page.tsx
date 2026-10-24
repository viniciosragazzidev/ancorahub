import { notFound } from "next/navigation";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import MotionPlaygroundPage from "./motion-playground";

/** Catálogo de movimento: só o diretor da empresa ou o super admin abrem. Os demais recebem 404. */
async function canOpenMotionCatalog() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (context?.role === "director") return true;
  return getRequiredPlatformAdmin().then(
    () => true,
    () => false,
  );
}

export default async function MotionCatalogPage() {
  if (!(await canOpenMotionCatalog())) notFound();
  return <MotionPlaygroundPage />;
}
