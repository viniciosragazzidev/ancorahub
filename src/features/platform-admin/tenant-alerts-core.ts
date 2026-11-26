/** Linha da tabela "Alertas por empresa" (super-admin, 26/11). Número null: não deu para contar. */
export type TenantAlertRow = {
  tenantId: string;
  name: string;
  active: boolean;
  openAlerts: number | null;
  openQuestions: number | null;
};

/**
 * Junta as contagens por empresa. Sem a tabela das perguntas (`questions` null), a coluna fica sem número.
 * Ordem: quem tem mais pendência primeiro; empate pelo nome.
 */
export function buildTenantAlertRows(
  tenants: readonly { id: string; name: string; status: string }[],
  alerts: ReadonlyMap<string, number | null>,
  questions: ReadonlyMap<string, number> | null,
): TenantAlertRow[] {
  const rows = tenants.map((tenant) => ({
    tenantId: tenant.id,
    name: tenant.name,
    active: tenant.status === "active",
    openAlerts: alerts.get(tenant.id) ?? null,
    openQuestions: questions ? questions.get(tenant.id) ?? 0 : null,
  }));
  const pending = (row: TenantAlertRow) => (row.openAlerts ?? 0) + (row.openQuestions ?? 0);
  return rows.sort((a, b) => pending(b) - pending(a) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Link da empresa no super-admin. */
export function tenantAdminHref(tenantId: string) {
  return `/super-admin/tenants/${encodeURIComponent(tenantId)}`;
}
