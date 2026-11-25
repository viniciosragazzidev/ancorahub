/**
 * Resultado linha a linha de uma importação Meta: tipos, textos em pt-BR e o CSV de problemas (Excel pt-BR:
 * separador ponto e vírgula e BOM). Sem dependência de servidor, para servir à tela e aos testes.
 */
import { encodeCsvDocument } from "@/features/reports/csv-export";

export type ImportRowStatus = "created" | "duplicate" | "invalid";

export type ImportResultRow = {
  /** Linha da planilha (cabeçalho é a 1). Nula em importações antigas, que não guardavam a linha dos leads criados. */
  rowIndex: number | null;
  status: ImportRowStatus;
  message: string | null;
  nome: string;
  telefone: string;
  leadId: string | null;
};

export type ImportResultSummary = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  errorMessage: string | null;
  createdAt: Date;
};

export type ImportResultDetail = { import: ImportResultSummary; rows: ImportResultRow[] };

const STATUS_LABEL: Record<ImportRowStatus, string> = {
  created: "Entrou",
  duplicate: "Duplicado",
  invalid: "Com problema",
};

export function importRowStatusLabel(status: string) {
  return STATUS_LABEL[status as ImportRowStatus] ?? "Com problema";
}

/** Motivo em pt-BR. O importador já grava os erros de validação em pt-BR; duplicado não tem mensagem própria. */
export function importRowReason(row: Pick<ImportResultRow, "status" | "message">) {
  const message = row.message?.trim();
  if (row.status === "created") return message || "Lead criado";
  if (row.status === "duplicate") return message || "Já existe um lead com o mesmo ID, telefone ou e-mail";
  return message || "Dados incompletos na linha";
}

export function isImportProblem(row: Pick<ImportResultRow, "status">) {
  return row.status !== "created";
}

export const IMPORT_PROBLEMS_CSV_COLUMNS = ["Linha da planilha", "Nome", "Telefone", "Situação", "Motivo"] as const;

/** CSV só com as linhas que não entraram (duplicadas e com problema), na ordem da planilha. */
export function buildImportProblemsCsv(rows: ImportResultRow[]) {
  const problems = rows.filter(isImportProblem).map((row) => ({
    "Linha da planilha": row.rowIndex ?? "",
    Nome: row.nome,
    Telefone: row.telefone,
    Situação: importRowStatusLabel(row.status),
    Motivo: importRowReason(row),
  }));
  return encodeCsvDocument(problems, [...IMPORT_PROBLEMS_CSV_COLUMNS]);
}

/** Ordem da planilha; linhas sem número (importações antigas) vão para o fim. */
export function sortImportRows(rows: ImportResultRow[]) {
  return [...rows].sort((a, b) => (a.rowIndex ?? Number.MAX_SAFE_INTEGER) - (b.rowIndex ?? Number.MAX_SAFE_INTEGER));
}
