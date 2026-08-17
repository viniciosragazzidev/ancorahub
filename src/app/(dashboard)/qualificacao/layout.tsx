import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function QualificationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getRequiredTenantContext();
  if (context.role === "manager") redirect("/access-denied");
  return children;
}
