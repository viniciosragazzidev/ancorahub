import { notFound } from "next/navigation";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import PrimitivesCatalog from "./primitives-catalog";

async function canOpenCatalog() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (context?.role === "director") return true;
  return getRequiredPlatformAdmin().then(() => true, () => false);
}

export default async function DesignSystemCatalogPage() {
  if (!(await canOpenCatalog())) notFound();
  return <PrimitivesCatalog />;
}
