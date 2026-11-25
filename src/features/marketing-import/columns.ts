/**
 * Colunas aceitas pelo importador de leads Meta (PF e PME). Fonte única para a validação no servidor e para a
 * planilha modelo baixada na tela: o cabeçalho é comparado sem acento e sem diferença de maiúsculas.
 */
export const MARKETING_IMPORT_SHARED_COLUMNS = [
  "nome", "email", "telefone", "operadora",
  "nome da campanha", "nome do conjunto de anúncio", "nome do anúncio",
  "id", "data",
] as const;

export const MARKETING_IMPORT_PF_COLUMNS = [...MARKETING_IMPORT_SHARED_COLUMNS, "tipo de plano"] as const;
export const MARKETING_IMPORT_PME_COLUMNS = [...MARKETING_IMPORT_SHARED_COLUMNS, "tipo de cnpj"] as const;

export type MarketingImportType = "pf" | "pme";

/** Cabeçalho da planilha modelo, na ordem do export do Meta. "Nome do formulário" é opcional. */
export const MARKETING_IMPORT_TEMPLATE_HEADERS: Record<MarketingImportType, readonly string[]> = {
  pf: ["ID", "Data", "Nome", "Email", "Telefone", "Operadora", "Nome da campanha", "Nome do conjunto de anúncio", "Nome do anúncio", "Nome do formulário", "Tipo de Plano"],
  pme: ["ID", "Data", "Nome", "Email", "Telefone", "Operadora", "Nome da campanha", "Nome do conjunto de anúncio", "Nome do anúncio", "Nome do formulário", "Tipo de CNPJ"],
};

export function normalizeImportHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Baixa a planilha modelo (.xlsx) no navegador. O pacote xlsx só carrega no clique. */
export async function downloadMarketingImportTemplate(type: MarketingImportType) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([[...MARKETING_IMPORT_TEMPLATE_HEADERS[type]]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, type === "pf" ? "PF" : "PME");
  XLSX.writeFile(book, `modelo-importacao-meta-${type}.xlsx`);
}
