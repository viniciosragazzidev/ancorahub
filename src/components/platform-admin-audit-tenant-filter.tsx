"use client";

/**
 * Filtro por empresa da auditoria (/super-admin/audit e /super-dev/audit): busca + seleção no visual Lite, com o valor
 * na URL (?tenant=). Os outros filtros da tela seguem como estão. Avisa a tela quando a empresa muda.
 */
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LiteUrlSelect } from "@/components/lite/controls";
import type { LiteOption } from "@/components/lite/controls/select";

export const AUDIT_TENANT_PARAM = "tenant";

export function auditTenantOptions(tenants: readonly { id: string; name: string }[]): LiteOption[] {
  return [{ value: "", label: "Todas as empresas" }, ...tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))];
}

export function AuditTenantFilter({ loadTenants, onTenantChange }: {
  loadTenants: () => Promise<{ id: string; name: string }[]>;
  onTenantChange: (tenantId: string) => void;
}) {
  const params = useSearchParams();
  const tenant = params.get(AUDIT_TENANT_PARAM) ?? "";
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    loadTenants().then((rows) => { if (alive) setTenants(rows); }).catch(() => undefined);
    return () => { alive = false; };
  }, [loadTenants]);

  useEffect(() => {
    onTenantChange(tenant);
  }, [tenant, onTenantChange]);

  const options = auditTenantOptions(tenants);
  // Empresa da URL que ainda não veio na lista: aparece pelo id até a lista chegar.
  if (tenant && !options.some((option) => option.value === tenant)) options.push({ value: tenant, label: tenant });

  return (
    <div className="arc-venancor w-full max-w-xs">
      <LiteUrlSelect label="Empresa" param={AUDIT_TENANT_PARAM} value={tenant} options={options} method="replace" />
    </div>
  );
}
