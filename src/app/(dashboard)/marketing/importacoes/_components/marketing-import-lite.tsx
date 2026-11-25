"use client";

/**
 * /marketing/importacoes no visual Lite (Onda 7): o mesmo envio (mesma Server Action, mesmos avisos), a mesma regra de
 * quem escolhe a unidade, a última importação e o histórico. A nova importação abre no painel lateral Lite.
 *
 * Feedback (FEEDBACK.md, nível 1): "Importar leads" mostra o envio no botão; o resumo "Importação concluída" no painel
 * é a confirmação (sem toast repetindo os números) e a falha fica no painel, com a causa e "Tentar de novo".
 */
import { useRef, useState, type DragEvent } from "react";
import { Download, FileDown, Plus } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { uploadMetaLeadsAction, type ImportHistoryItem } from "@/features/marketing-import/actions";
import { downloadMarketingImportTemplate, type MarketingImportType } from "@/features/marketing-import/columns";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { ImportResultPanel, type ImportResultTarget } from "./import-result-panel";
import styles from "./marketing-import-lite.module.css";

type Branch = { id: string; name: string };

type ImportResult = {
  importId: string;
  imported: number;
  duplicates: number;
  invalid: number;
  durationMs: number;
  errors: Array<{ row: number; message: string }>;
};

const count = new Intl.NumberFormat("pt-BR");
const dateTime = { dateStyle: "short", timeStyle: "short" } as const;

function statusLabel(status: string) {
  switch (status) {
    case "completed": return "Concluído";
    case "failed": return "Falhou";
    case "processing": return "Processando";
    default: return status;
  }
}

function statusTone(status: string) {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

const HISTORY_COLUMNS: LiteColumn<ImportHistoryItem>[] = [
  {
    id: "when",
    label: "Quando",
    secondary: true,
    nowrap: true,
    render: (item) => (
      <span className={styles.stackCell}>
        <span className={styles.tabular}>{formatLiteDate(item.createdAt, dateTime)}</span>
        {item.userName ? <span className={page.cellSub}>{item.userName}</span> : null}
      </span>
    ),
  },
  {
    id: "file",
    label: "Arquivo",
    primary: true,
    render: (item) => (
      <span className={styles.stackCell}>
        <span className={`${page.cellTitle} ${styles.truncate}`} title={item.fileName}>{item.fileName}</span>
        {item.status !== "completed" ? <span><span className={page.badge} data-tone={statusTone(item.status)}>{statusLabel(item.status)}</span></span> : null}
      </span>
    ),
  },
  { id: "total", label: "Total", numeric: true, render: (item) => count.format(item.totalRows) },
  { id: "created", label: "Entraram", numeric: true, render: (item) => count.format(item.importedCount) },
  { id: "duplicates", label: "Duplicados", numeric: true, render: (item) => count.format(item.duplicateCount) },
  { id: "invalid", label: "Com problema", numeric: true, render: (item) => count.format(item.invalidCount) },
];

export function MarketingImportLite({ branches, history, lastImport, canChooseBranch, userBranchId }: {
  branches: Branch[];
  history: ImportHistoryItem[];
  lastImport: ImportHistoryItem | null;
  /** Mesma regra da tela atual (calculada no servidor a partir do papel e do cargo). */
  canChooseBranch: boolean;
  userBranchId: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState(userBranchId ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fire = useFeedback();
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [resultTarget, setResultTarget] = useState<ImportResultTarget | null>(null);
  const [lastFileName, setLastFileName] = useState("");
  const [templateBusy, setTemplateBusy] = useState<MarketingImportType | null>(null);

  async function downloadTemplate(type: MarketingImportType) {
    if (templateBusy) return;
    setTemplateBusy(type);
    try {
      await downloadMarketingImportTemplate(type);
    } catch {
      fire("error");
      setError({ message: "Não deu para gerar a planilha modelo agora. Tente de novo.", retryable: false });
    } finally {
      setTemplateBusy(null);
    }
  }

  function openResult(target: ImportResultTarget) {
    setPanelOpen(false);
    setResultTarget(target);
  }

  async function handleSubmit() {
    if (busy) return;
    if (!file) {
      fire("error");
      setError({ message: "Selecione um arquivo.", retryable: false });
      return;
    }
    setBusy(true);
    setResult(null);
    setError(null);
    fire("tap");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("branchId", branchId);

    const fail = (cause: unknown) => {
      fire("error");
      const info = normalizeActionError(cause, "Não deu para importar a planilha agora.");
      setError({ message: actionErrorMessage(info, "Nenhum lead foi criado. O arquivo continua selecionado."), retryable: info.retryable });
    };
    let response: Awaited<ReturnType<typeof uploadMetaLeadsAction>>;
    try {
      response = await uploadMetaLeadsAction(formData);
    } catch (cause) {
      setBusy(false);
      fail(cause);
      return;
    }
    setBusy(false);

    if (!("importId" in response) || !response.success) {
      fail("error" in response ? response.error : null);
      return;
    }

    // O resumo "Importação concluída" no painel é a confirmação: importados, duplicados e inválidos.
    const r = response as ImportResult;
    setResult({ importId: r.importId, imported: r.imported, duplicates: r.duplicates, invalid: r.invalid, durationMs: r.durationMs, errors: r.errors });
    fire("confirm");
    setLastFileName(file.name);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div className={styles.layout}>
        <section className={page.card} aria-labelledby="import-action-title">
          <div className={styles.headRow}>
            <div className={page.cardHead}>
              <h2 id="import-action-title" className={page.cardTitle}>Importar planilha Meta</h2>
              <p className={page.cardDescription}>Faça upload da planilha exportada do Meta Ads. Apenas os formatos estruturados PF e PME são aceitos. Formatos .xlsx, .xls e .csv, até 10 MB.</p>
            </div>
            <button type="button" className={page.primaryButton} onClick={() => setPanelOpen(true)} aria-haspopup="dialog">
              <Plus aria-hidden="true" size={16} /> Nova importação
            </button>
          </div>
          {lastImport ? (
            <div className={styles.lastImport}>
              <h3 className={styles.subTitle}>Última importação</h3>
              <dl className={styles.facts}>
                <div><dt>Data</dt><dd>{formatLiteDate(lastImport.createdAt, dateTime)}</dd></div>
                <div><dt>Arquivo</dt><dd className={styles.truncate} title={lastImport.fileName}>{lastImport.fileName}</dd></div>
                <div><dt>Responsável</dt><dd>{lastImport.userName ?? "Não informado"}</dd></div>
                <div><dt>Resultado</dt><dd>{count.format(lastImport.importedCount)} importados · {count.format(lastImport.duplicateCount)} dup. · {count.format(lastImport.invalidCount)} inválidos</dd></div>
                <div><dt>Status</dt><dd><span className={page.badge} data-tone={lastImport.status === "completed" ? "success" : "danger"}>{statusLabel(lastImport.status)}</span></dd></div>
              </dl>
            </div>
          ) : null}
        </section>

        <section className={page.card} aria-labelledby="import-history-title">
          <div className={page.cardHead}>
            <h2 id="import-history-title" className={page.cardTitle}>Histórico de importações</h2>
            <p className={page.cardDescription}>Últimas 50 importações. Abra uma linha para ver o resultado linha a linha.</p>
          </div>
          {history.length === 0 ? (
            <div className={page.empty}>
              <FileDown aria-hidden="true" size={24} />
              <p className={page.emptyTitle}>Nenhuma importação realizada ainda</p>
              <p className={page.emptyText}>Use “Nova importação” para enviar a primeira planilha.</p>
            </div>
          ) : (
            <LiteResponsiveData
              caption="Histórico de importações"
              columns={HISTORY_COLUMNS}
              rows={history}
              rowKey={(item) => item.id}
              onRowOpen={(item) => setResultTarget({ id: item.id, fileName: item.fileName })}
              empty={null}
            />
          )}
        </section>
      </div>

      <LiteSidePanel open={panelOpen} onOpenChange={setPanelOpen} title="Nova importação" description="Faça upload da planilha Meta Ads (.xlsx, .xls, .csv)">
        <div className={styles.panel}>
          <div
            className={styles.drop}
            data-active={dragOver ? "true" : undefined}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FileDown aria-hidden="true" size={24} className={styles.dropIcon} />
            {file ? (
              <>
                <p className={page.cellTitle}>{file.name}</p>
                <p className={page.cellSub}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button type="button" className={page.button} onClick={clearFile}>Remover</button>
              </>
            ) : (
              <>
                <p className={page.cellTitle}>Arraste a planilha aqui</p>
                <p className={page.cellSub}>ou</p>
                <button type="button" className={page.button} onClick={() => inputRef.current?.click()}>Selecionar arquivo</button>
              </>
            )}
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>

          {canChooseBranch ? (
            <LiteSelect
              label="Unidade de destino"
              value={branchId}
              placeholder="Selecione uma unidade"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              onChange={setBranchId}
            />
          ) : (
            <p className={styles.note}>Os leads serão importados para sua unidade.</p>
          )}

          <p className={styles.note}>
            Colunas esperadas: <code>ID</code>, <code>Data</code>, <code>Nome</code>, <code>Email</code>, <code>Telefone</code>, <code>Operadora</code>, <code>Nome da campanha</code>, <code>Nome do conjunto de anúncio</code>, <code>Nome do anúncio</code> e <code>Tipo de Plano</code> (PF) ou <code>Tipo de CNPJ</code> (PME). A coluna <code>Nome do formulário</code> é opcional; quando ausente, os leads são registrados como “Formulário Direct”.
          </p>

          <div className={styles.templateRow} role="group" aria-label="Baixar planilha modelo">
            <button type="button" className={page.button} onClick={() => void downloadTemplate("pf")} disabled={templateBusy !== null}>
              <Download aria-hidden="true" size={16} /> Baixar planilha modelo PF
            </button>
            <button type="button" className={page.button} onClick={() => void downloadTemplate("pme")} disabled={templateBusy !== null}>
              <Download aria-hidden="true" size={16} /> Baixar planilha modelo PME
            </button>
          </div>

          <button type="button" className={`${page.primaryButton} ${styles.fullWidth}`} onClick={() => void handleSubmit()} disabled={busy || !file || (canChooseBranch && !branchId)} aria-busy={busy || undefined}>
            {busy ? (
              <>
                <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                Importando…
              </>
            ) : error?.retryable ? "Tentar de novo" : "Importar leads"}
          </button>

          {error ? <p className={styles.note} role="alert" style={{ color: "var(--danger)" }}>{error.message}</p> : null}

          {result ? (
            <div className={styles.result} role="status">
              <p className={styles.subTitle}>Importação concluída</p>
              <dl className={styles.resultGrid}>
                <div><dt>Importados</dt><dd>{count.format(result.imported)}</dd></div>
                <div><dt>Duplicados</dt><dd>{count.format(result.duplicates)}</dd></div>
                <div><dt>Inválidos</dt><dd>{count.format(result.invalid)}</dd></div>
              </dl>
              {(result.durationMs ?? 0) > 0 ? <p className={page.cellSub}>Tempo: {(result.durationMs / 1000).toFixed(1).replace(".", ",")} segundos</p> : null}
              <button type="button" className={page.button} onClick={() => openResult({ id: result.importId, fileName: lastFileName || "Resultado da importação" })}>
                {result.errors.length > 0 || result.duplicates > 0 ? "Ver problemas linha a linha" : "Ver resultado linha a linha"}
              </button>
            </div>
          ) : null}
        </div>
      </LiteSidePanel>

      <ImportResultPanel target={resultTarget} onClose={() => setResultTarget(null)} />
    </>
  );
}
