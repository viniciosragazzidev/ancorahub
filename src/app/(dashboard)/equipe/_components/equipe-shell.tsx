"use client";

import { DashboardHeader } from "@/components/dashboard-header";

export function EquipeHeader({ tenantName }: { tenantName: string }) {
  return <DashboardHeader breadcrumb={tenantName} title="Equipe" />;
}
