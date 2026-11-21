import { redirect } from "next/navigation";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getRequiredTenantContext();
  // Papel manager com a função marketing é o time de marketing e abre a área; gestor de unidade e financeiro não (P3, 20/11).
  if (context.role === "manager" && context.jobTitle !== "marketing") redirect("/access-denied");
  return children;
}
