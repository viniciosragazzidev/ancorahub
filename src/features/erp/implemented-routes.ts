/** Only routes backed by complete pages/services enter the assignable catalog. */
export const ERP_IMPLEMENTED_PATHS: ReadonlySet<string> = new Set(["/administracao/erp", "/implantacoes", "/administracao/importacoes", "/financeiro", "/financeiro/adiantamentos", "/financeiro/fluxo-caixa", "/financeiro/fechamentos"]);

export function erpModuleForImplementedPath(pathname: string): "implantations" | "finance" | "imports" | "referrals" | "incentives" | "analytics" | "tv" | null {
  const path = [...ERP_IMPLEMENTED_PATHS].filter((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`)).sort((a, b) => b.length - a.length)[0];
  if (!path || path === "/administracao/erp") return null;
  if (path === "/implantacoes") return "implantations";
  if (path === "/administracao/importacoes") return "imports";
  if (path === "/confirmacoes" || path.startsWith("/financeiro")) return "finance";
  if (path === "/indicacoes") return "referrals";
  if (path === "/campanhas-incentivo") return "incentives";
  if (path === "/tv") return "tv";
  return "analytics";
}
