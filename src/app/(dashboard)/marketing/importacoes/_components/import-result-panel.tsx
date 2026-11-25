"use client";

/**
 * Gaveta "Resultado da importação" (Lite): a planilha linha a linha, com "Só problemas" ligado quando há problema,
 * link para o lead criado e "Baixar problemas (CSV)". A consulta roda no servidor com a mesma permissão da tela.
 *
 * Feedback (FEEDBACK.md): abrir e filtrar são nível 0; o download é nível 0 (o navegador mostra o arquivo).
 * Falha ao carregar mostra a causa e "Tentar de novo".
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { getImportResultsAction } from "@/features/marketing-import/actions";
import {
  buildImportProblemsCsv,
  importRowReason,
  importRowStatusLabel,
  isImportProblem,
  type ImportResultDetail,
  type ImportResultRow,
} from "@/features/marketing-import/results";
import { formatPhone } from "@/shared/utils/format";
import styles from "./marketing-import-lite.module.css";

const count = new Intl.NumberFormat("pt-BR");
const dateTime = { dateStyle: "short", timeStyle: "short" } as const;

function displayPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  return local.length >= 10 ? formatPhone(local) : value;
}

function statusTone(status: ImportResultRow["status"]) {
  if (status === "created") return "success";
  if (status === "duplicate") return "warning";
  return "danger";
}

const COLUMNS: LiteColumn<ImportResultRow>[] = [
  { id: "row", label: "Linha da planilha", numeric: true, render: (row) => (row.rowIndex == null ? "Sem número" : count.format(row.rowIndex)) },
  {
    id: "name",
    label: "Nome",
    primary: true,
    render: (row) => (row.leadId && row.status === "created"
      ? <Link href={`/leads/${row.leadId}`} className={`${page.cellTitle} ${page.cellLink}`} title={row.nome}>{row.nome || "Sem nome"}</Link>
      : <span className={page.cellTitle} title={row.nome}>{row.nome || "Sem nome"}</span>),
  },
  { id: "phone", label: "Telefone", nowrap: true, render: (row) => <span className={styles.tabular}>{row.telefone ? displayPhone(row.telefone) : "Sem telefone"}</span> },
  { id: "status", label: "Situação", render: (row) => <span className={page.badge} data-tone={statusTone(row.status)}>{importRowStatusLabel(row.status)}</span> },
  { id: "reason", label: "Motivo", render: (row) => <span className={page.cellSub}>{importRowReason(row)}</span> },
];

export type ImportResultTarget = { id: string; fileName: string };

export function ImportResultPanel({ target, onClose }: { target: ImportResultTarget | null; onClose: () => void }) {
  const [detail, setDetail] = useState<ImportResultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getImportResultsAction(id);
      if (response.ok) {
        setDetail(response.detail);
        setOnlyProblems(response.detail.rows.some(isImportProblem));
      } else {
        setError(response.error);
      }
    } catch {
      setError("Não deu para carregar o resultado agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    if (target) void load(target.id);
  }, [target, load]);

  const rows = detail?.rows ?? [];
  const problems = useMemo(() => rows.filter(isImportProblem), [rows]);
  const visible = onlyProblems ? problems : rows;
  const created = rows.length - problems.length;

  function downloadProblems() {
    if (!detail || problems.length === 0) return;
    const blob = new Blob([buildImportProblemsCsv(detail.rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `problemas-${detail.import.fileName.replace(/\.[^.]+$/, "")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const description = detail
    ? `${formatLiteDate(detail.import.createdAt, dateTime)} · ${count.format(detail.import.totalRows)} ${detail.import.totalRows === 1 ? "linha" : "linhas"}`
    : "Resultado linha a linha";

  return (
    <LiteSidePanel open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }} title={target?.fileName ?? "Resultado da importação"} description={description}>
      <div className={styles.panel}>
        {loading && !detail ? <p className={page.cellSub} role="status">Carregando o resultado…</p> : null}

        {error ? (
          <div className={styles.result} role="alert">
            <p className={styles.subTitle}>Resultado indisponível</p>
            <p className={page.cellSub}>{error} O histórico continua salvo.</p>
            <button type="button" className={page.button} onClick={() => target && void load(target.id)} disabled={loading}>Tentar de novo</button>
          </div>
        ) : null}

        {detail ? (
          <>
            {detail.import.status === "failed" ? (
              <p className={styles.note} role="status">A importação falhou: {detail.import.errorMessage ?? "sem causa registrada"}. Nenhum lead desta planilha foi criado.</p>
            ) : null}
            <dl className={styles.resultGrid}>
              <div><dt>Entraram</dt><dd>{count.format(detail.import.importedCount)}</dd></div>
              <div><dt>Duplicados</dt><dd>{count.format(detail.import.duplicateCount)}</dd></div>
              <div><dt>Com problema</dt><dd>{count.format(detail.import.invalidCount)}</dd></div>
            </dl>
            <div className={styles.resultToolbar}>
              <LiteFilterChips
                label="Filtro do resultado"
                chips={[{ id: "problems", label: "Só problemas", count: problems.length }]}
                active={onlyProblems ? ["problems"] : []}
                onToggle={() => setOnlyProblems((value) => !value)}
              />
              <button type="button" className={page.button} onClick={downloadProblems} disabled={problems.length === 0}>
                <Download aria-hidden="true" size={16} /> Baixar problemas (CSV)
              </button>
            </div>
            <LiteResponsiveData
              caption="Resultado da importação linha a linha"
              columns={COLUMNS}
              rows={visible}
              rowKey={(row) => `${row.rowIndex ?? "x"}-${row.leadId ?? ""}-${row.status}-${row.telefone}`}
              empty={onlyProblems && created > 0
                ? <p className={page.emptyText}>Nenhum problema. Todas as linhas entraram.</p>
                : <p className={page.emptyText}>Nenhuma linha registrada nesta importação.</p>}
            />
          </>
        ) : null}
      </div>
    </LiteSidePanel>
  );
}
