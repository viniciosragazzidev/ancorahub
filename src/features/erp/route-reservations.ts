import type { PermissionKey } from "@/shared/auth/permissions";
import { ERP_IMPLEMENTED_PATHS } from "./implemented-routes";

/** Planning metadata only: these audiences are not capabilities or grants. */
export type ErpAudience =
  | "broker" | "supervisor" | "unit-manager" | "director" | "operations"
  | "finance-reviewer" | "finance-approver" | "payout-executor"
  | "marketing" | "relationship" | "auditor" | "tenant-access-admin";

type RouteReservation = {
  key: string;
  path: string;
  label: string;
  description: string;
  category: string;
  fallbackPermission: PermissionKey;
  readiness?: "planned";
  audiences: readonly ErpAudience[];
};

function reserve(
  key: string,
  path: string,
  label: string,
  fallbackPermission: PermissionKey,
  audiences: readonly ErpAudience[],
): RouteReservation {
  return {
    key: `erp-${key}`, path, label, fallbackPermission, audiences,
    category: "ERP em planejamento",
    description: `${label}: reserva bloqueada até implementação e governança do módulo.`,
    readiness: "planned",
  };
}

const FINANCE: readonly ErpAudience[] = ["finance-reviewer", "director"];
const PERSONAL_FINANCE: readonly ErpAudience[] = ["broker", "finance-reviewer", "director"];
const PERFORMANCE: readonly ErpAudience[] = ["broker", "supervisor", "unit-manager", "director"];

/**
 * DEC-183. No pages, role assignments or product availability are created here.
 * Reservations stay OUT of the assignable route catalog and navigation. The
 * canonical resolver recognizes them so legacy access cannot accidentally allow
 * a future page before its module is ready. Fallbacks are NOT final action grants.
 */
export const ERP_ROUTE_PLAN: readonly RouteReservation[] = [
  reserve("implantacoes", "/implantacoes", "Implantação", "erp_view_operations", [...PERFORMANCE, "operations"]),
  reserve("confirmacoes", "/confirmacoes", "Conferência de pagamentos", "acessar_financeiro", FINANCE),
  reserve("financeiro", "/financeiro", "Financeiro", "erp_view_finance", PERSONAL_FINANCE),
  reserve("recebiveis", "/financeiro/recebiveis", "Recebíveis", "acessar_financeiro", FINANCE),
  reserve("despesas", "/financeiro/despesas", "Despesas", "acessar_financeiro", [...FINANCE, "finance-approver", "payout-executor"]),
  reserve("caixa", "/financeiro/fluxo-caixa", "Fluxo de caixa", "erp_view_finance", FINANCE),
  reserve("conciliacao", "/financeiro/conciliacao", "Conciliação", "acessar_financeiro", [...FINANCE, "finance-approver"]),
  reserve("comissoes", "/financeiro/comissoes", "Comissões", "ver_comissao_propria", PERSONAL_FINANCE),
  reserve("repasses", "/financeiro/repasses", "Repasses", "ver_comissao_propria", [...PERSONAL_FINANCE, "finance-approver", "payout-executor"]),
  reserve("recibos", "/financeiro/recibos", "Recibos", "ver_comissao_propria", PERSONAL_FINANCE),
  reserve("adiantamentos", "/financeiro/adiantamentos", "Adiantamentos", "erp_view_finance", [...PERSONAL_FINANCE, "finance-approver"]),
  reserve("fechamentos", "/financeiro/fechamentos", "Fechamentos", "erp_view_finance", [...FINANCE, "finance-approver"]),
  reserve("indicacoes", "/indicacoes", "Indicações", "acessar_leads", [...PERFORMANCE, "operations"]),
  reserve("metas", "/metas", "Metas", "acessar_dashboard", PERFORMANCE),
  reserve("incentivos", "/campanhas-incentivo", "Incentivos", "acessar_dashboard", [...PERFORMANCE, "finance-reviewer"]),
  reserve("producao", "/relatorios/producao", "Produção", "acessar_relatorios", [...PERFORMANCE, "operations", "finance-reviewer"]),
  reserve("operadoras", "/relatorios/operadoras", "Operadoras", "acessar_relatorios", [...PERFORMANCE, "operations", "finance-reviewer"]),
  reserve("crescimento", "/relatorios/crescimento", "Crescimento", "acessar_relatorios", ["supervisor", "unit-manager", "finance-reviewer", "director"]),
  reserve("diario", "/relatorios/diario", "Análise diária", "acessar_relatorios", [...PERFORMANCE, "operations"]),
  reserve("tv", "/tv", "Modo TV", "acessar_dashboard", PERFORMANCE),
  reserve("importacoes", "/administracao/importacoes", "Importações", "erp_import_data", ["operations", "finance-reviewer", "director"]),
  reserve("governanca", "/administracao/erp", "Governança ERP", "erp_manage_modules", ["director", "tenant-access-admin"]),
];

export const ERP_ROUTE_RESERVATIONS = ERP_ROUTE_PLAN.filter((route) => !ERP_IMPLEMENTED_PATHS.has(route.path));
export const ERP_IMPLEMENTED_ROUTES = ERP_ROUTE_PLAN.filter((route) => ERP_IMPLEMENTED_PATHS.has(route.path)).map((route) => ({ ...route, readiness: undefined, noCargo: route.key === "erp-governanca", category: "ERP operacional" }));

/** Returns future audience mappings for planning, never an authorization result. */
export function listErpReservationsForAudience(audience: ErpAudience) {
  return ERP_ROUTE_PLAN.filter((route) => route.audiences.includes(audience));
}
