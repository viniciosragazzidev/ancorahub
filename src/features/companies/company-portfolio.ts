/** Carteira PJ (/empresas): oportunidades abertas e total por empresa. Puro. */

const CLOSED_STATUSES = new Set(["converted", "lost"]);

/** Oportunidade aberta: ainda não virou venda nem foi perdida. */
export function isOpenLeadStatus(status: string) {
  return !CLOSED_STATUSES.has(status);
}

export function countCompanyLeads(leads: { companyId: string | null; status: string }[]) {
  const counts = new Map<string, { open: number; total: number }>();
  for (const lead of leads) {
    if (!lead.companyId) continue;
    const current = counts.get(lead.companyId) ?? { open: 0, total: 0 };
    current.total += 1;
    if (isOpenLeadStatus(lead.status)) current.open += 1;
    counts.set(lead.companyId, current);
  }
  return counts;
}

/** "2 abertas de 5", "1 aberta", "Nenhuma". */
export function opportunitiesLabel(open: number, total: number) {
  if (!total) return "Nenhuma";
  const openText = `${open.toLocaleString("pt-BR")} ${open === 1 ? "aberta" : "abertas"}`;
  return open === total ? openText : `${openText} de ${total.toLocaleString("pt-BR")}`;
}
