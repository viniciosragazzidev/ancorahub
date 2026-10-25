"use client";

/**
 * /marketing/importacoes no visual Lite (Onda 7): o mesmo envio (mesma Server Action, mesmos avisos), a mesma regra de
 * quem escolhe a unidade, a última importação e o histórico. A nova importação abre no painel lateral Lite.
 */
import { useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Clock, FileDown, Plus, XCircle } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { uploadMetaLeadsAction, type ImportHistoryItem } from "@/features/marketing-import/actions";
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

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" size={18} className={styles.iconSuccess} />;
  if (status === "failed") return <XCircle aria-hidden="true" size={18} className={styles.iconDanger} />;
  return <Clock aria-hidden="true" size={18} className={styles.iconWarning} />;
}

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

  async function handleSubmit() {
    if (!file) return toast.error("Selecione um arquivo.");
    setBusy(true);
    setResult(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("branchId", branchId);

    const response = await uploadMetaLeadsAction(formData);
    setBusy(false);

    if (!("importId" in response) || !response.success) {
      return toast.error("error" in response ? response.error ?? "Erro ao importar." : "Erro ao importar.");
    }

    const r = response as ImportResult;
    setResult({ importId: r.importId, imported: r.imported, duplicates: r.duplicates, invalid: r.invalid, durationMs: r.durationMs, errors: r.errors });
    toast.success(`${r.imported} lead(s) importado(s)!`);
    if (r.duplicates > 0) toast.info(`${r.duplicates} lead(s) duplicado(s) ignorado(s).`);
    if (r.invalid > 0) toast.warning(`${r.invalid} linha(s) inválida(s). Verifique o resumo para mais detalhes.`);
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
            <p className={page.cardDescription}>Últimas 50 importações realizadas.</p>
          </div>
          {history.length === 0 ? (
            <div className={page.empty}>
              <FileDown aria-hidden="true" size={24} />
              <p className={page.emptyTitle}>Nenhuma importação realizada ainda</p>
              <p className={page.emptyText}>Use “Nova importação” para enviar a primeira planilha.</p>
            </div>
          ) : (
            <ul className={styles.history}>
              {history.map((item) => (
                <li key={item.id} className={styles.historyRow}>
                  <StatusIcon status={item.status} />
                  <span className={styles.historyText}>
                    <span className={`${page.cellTitle} ${styles.truncate}`} title={item.fileName}>{item.fileName}</span>
                    <span className={page.cellSub}>{formatLiteDate(item.createdAt, dateTime)}{item.userName ? ` · ${item.userName}` : ""}</span>
                    <span className={page.cellSub}>{count.format(item.importedCount)} importados · {count.format(item.duplicateCount)} dup. · {count.format(item.invalidCount)} invál.</span>
                  </span>
                  <span className={page.badge} data-tone={statusTone(item.status)}>{statusLabel(item.status)}</span>
                </li>
              ))}
            </ul>
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
            Colunas esperadas: <code>ID</code>, <code>Data</code>, <code>Nome</code>, <code>E-mail</code>, <code>Telefone</code>, <code>Operadora</code>, <code>Nome da campanha</code>, <code>Nome do conjunto de anúncio</code>, <code>Nome do anúncio</code>. A coluna <code>Nome do formulário</code> é opcional; quando ausente, os leads são registrados como “Formulário Direct”.
          </p>

          <button type="button" className={`${page.primaryButton} ${styles.fullWidth}`} onClick={() => void handleSubmit()} disabled={busy || !file || (canChooseBranch && !branchId)}>
            {busy ? "Importando..." : "Importar leads"}
          </button>

          {result ? (
            <div className={styles.result} role="status">
              <p className={styles.subTitle}>Importação concluída</p>
              <dl className={styles.resultGrid}>
                <div><dt>Importados</dt><dd>{count.format(result.imported)}</dd></div>
                <div><dt>Duplicados</dt><dd>{count.format(result.duplicates)}</dd></div>
                <div><dt>Inválidos</dt><dd>{count.format(result.invalid)}</dd></div>
              </dl>
              {(result.durationMs ?? 0) > 0 ? <p className={page.cellSub}>Tempo: {(result.durationMs / 1000).toFixed(1).replace(".", ",")} segundos</p> : null}
              {result.errors.length > 0 ? (
                <details className={styles.errors}>
                  <summary>{result.errors.length} erro(s): ver detalhes</summary>
                  <ul>
                    {result.errors.slice(0, 10).map((error, index) => <li key={index}>Linha {error.row}: {error.message}</li>)}
                    {result.errors.length > 10 ? <li>...e mais {result.errors.length - 10}</li> : null}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </LiteSidePanel>
    </>
  );
}
