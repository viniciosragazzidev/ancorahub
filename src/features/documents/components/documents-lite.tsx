"use client";

/**
 * /documentos no visual Lite do diretor. Mesmas regras e ações da tela atual: fila de aprovação com filtro por status
 * (com contagens), busca, seleção com aprovar e rejeitar em lote, aprovar, rejeitar e alterar status por linha; e a
 * configuração de requisitos com a lista, excluir (com confirmação Lite em vez do confirm do navegador) e o
 * formulário de novo requisito. Mesmas Server Actions, mensagens e o tratamento de versão nova do sistema.
 */
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, RefreshCw, Search, Trash2, XCircle } from "lucide-react";

import { LiteBulkBar, LiteConfirmDialog, LiteFilterChips, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import form from "@/components/lite/page/lite-form.module.css";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkReviewDocumentsAction, createRequirementAction, deleteRequirementAction, reviewDocumentAction } from "@/features/documents/actions";

import styles from "./documents-lite.module.css";

type Carrier = { id: string; name: string };
type Plan = { id: string; name: string; carrierName: string };
export type RequirementLite = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesPerBeneficiary: boolean;
  carrierId: string | null;
  carrierName: string | null;
  planId: string | null;
  planName: string | null;
};
export type PendingDocLite = {
  id: string;
  filename: string;
  fileUrl: string;
  status: string;
  createdAt: Date;
  leadId: string;
  leadNome: string;
  corretorNome: string | null;
  branchName: string | null;
  requirementName: string | null;
};

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const sentAt = liteDateFormatter({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function isVersionSkewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to find server action|older or newer deployment|version skew/i.test(message);
}

function reloadAfterDeploymentUpdate() {
  toast.info("O sistema foi atualizado. Recarregando esta tela…");
  window.setTimeout(() => window.location.reload(), 250);
}

const STATUS_BADGE: Record<string, { label: string; tone?: "success" | "danger" }> = {
  approved: { label: "Aprovado", tone: "success" },
  rejected: { label: "Rejeitado", tone: "danger" },
};

export function DocumentsLite({ carriers, plans, initialRequirements, initialPendingDocs, canConfigure = false }: {
  /** Aba "Configuração de requisitos": a mesma regra do DocumentsWorkspace (só o diretor). */
  canConfigure?: boolean;
  carriers: Carrier[];
  plans: Plan[];
  initialRequirements: RequirementLite[];
  initialPendingDocs: PendingDocLite[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [requirements, setRequirements] = useState(initialRequirements);
  const [docs, setDocs] = useState(initialPendingDocs);
  const [deleting, setDeleting] = useState<RequirementLite | null>(null);
  const [carrierId, setCarrierId] = useState("");
  const [planId, setPlanId] = useState("");
  const [, startTransition] = useTransition();
  const [reqState, reqAction, reqPending] = useActionState(createRequirementAction, {});
  const reqFormRef = useRef<HTMLFormElement>(null);
  const [reqKey, setReqKey] = useState(0);

  useEffect(() => {
    if (reqState.success) {
      toast.success("Requisito criado com sucesso!");
      reqFormRef.current?.reset();
      setCarrierId("");
      setPlanId("");
      setReqKey((key) => key + 1);
      router.refresh();
    }
    if (reqState.error) toast.error(reqState.error);
  }, [reqState, router]);
  useEffect(() => setRequirements(initialRequirements), [initialRequirements]);
  useEffect(() => setDocs(initialPendingDocs), [initialPendingDocs]);

  const counts = useMemo(() => ({
    pending: docs.filter((doc) => doc.status === "pending").length,
    approved: docs.filter((doc) => doc.status === "approved").length,
    rejected: docs.filter((doc) => doc.status === "rejected").length,
    all: docs.length,
  }), [docs]);

  const filtered = useMemo(() => {
    const byStatus = status === "all" ? docs : docs.filter((doc) => doc.status === status);
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return byStatus;
    return byStatus.filter((doc) => [doc.leadNome, doc.filename, doc.requirementName ?? ""].some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [docs, status, query]);

  const ids = useMemo(() => filtered.map((doc) => doc.id), [filtered]);
  const multiSelect = useMultiSelect(ids);
  const { pageRows, pagination } = useLitePages(filtered, 10);

  const review = (docId: string, leadId: string, next: "approved" | "rejected") => {
    startTransition(async () => {
      try {
        const result = await reviewDocumentAction({ documentId: docId, leadId, status: next });
        if (result.error) toast.error(result.error);
        else {
          toast.success(next === "approved" ? "Documento aprovado." : "Documento rejeitado.");
          setDocs((current) => current.map((doc) => (doc.id === docId ? { ...doc, status: next } : doc)));
        }
      } catch (error) {
        if (isVersionSkewError(error)) reloadAfterDeploymentUpdate();
        else toast.error("Não foi possível atualizar o documento. Tente novamente.");
      }
    });
  };

  const bulkReview = (next: "approved" | "rejected") => {
    const selected = multiSelect.selectedIds;
    if (selected.length === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkReviewDocumentsAction(selected, next);
        if (result.error) toast.error(result.error);
        else {
          toast.success(`Processamento em lote concluído (${selected.length} itens).`);
          setDocs((current) => current.map((doc) => (selected.includes(doc.id) ? { ...doc, status: next } : doc)));
          multiSelect.clear();
        }
      } catch (error) {
        if (isVersionSkewError(error)) reloadAfterDeploymentUpdate();
        else toast.error("Não foi possível atualizar os documentos. Tente novamente.");
      }
    });
  };

  const confirmDelete = () => {
    const requirement = deleting;
    setDeleting(null);
    if (!requirement) return;
    startTransition(async () => {
      const result = await deleteRequirementAction(requirement.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Requisito removido.");
        setRequirements((current) => current.filter((item) => item.id !== requirement.id));
      }
    });
  };
  const cancelDelete = useCallback(() => setDeleting(null), []);

  const columns: LiteColumn<PendingDocLite>[] = [
    { id: "lead", label: "Lead", primary: true, render: (doc) => <a href={`/leads/${doc.leadId}`} className={styles.link}>{doc.leadNome}</a> },
    {
      id: "file",
      label: "Documento e tipo",
      render: (doc) => (
        <span className={styles.fileCell}>
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.link} aria-label={`Abrir ${doc.filename} em nova aba`} title={doc.filename}>
            <span className={styles.ellipsis}>{doc.filename}</span>
            <ExternalLink aria-hidden="true" size={14} />
          </a>
          <span className={page.cellSub}>{doc.requirementName ?? "Avulso"}</span>
        </span>
      ),
    },
    { id: "status", label: "Status", render: (doc) => <span className={page.badge} data-tone={STATUS_BADGE[doc.status]?.tone}>{STATUS_BADGE[doc.status]?.label ?? "Pendente"}</span> },
    {
      id: "owner",
      label: "Responsável e unidade",
      nowrap: true,
      render: (doc) => doc.corretorNome || doc.branchName
        ? <span title={[doc.corretorNome, doc.branchName].filter(Boolean).join(", ")}><span>{doc.corretorNome ?? "Sem corretor"}</span><span className={page.cellSub}>{doc.branchName ?? "Sem unidade"}</span></span>
        : <span className={page.muted}>Não informado</span>,
    },
    { id: "sent", label: "Data de envio", render: (doc) => <span className={page.numeric}>{sentAt.format(new Date(doc.createdAt))}</span> },
    {
      id: "actions",
      label: "Ações",
      render: (doc) => doc.status === "pending" ? (
        <span className={styles.rowActions}>
          <button type="button" className={styles.iconSuccess} aria-label={`Aprovar ${doc.filename} de ${doc.leadNome}`} title="Aprovar" onClick={() => review(doc.id, doc.leadId, "approved")}><CheckCircle2 aria-hidden="true" size={18} /></button>
          <button type="button" className={styles.iconDanger} aria-label={`Rejeitar ${doc.filename} de ${doc.leadNome}`} title="Rejeitar" onClick={() => review(doc.id, doc.leadId, "rejected")}><XCircle aria-hidden="true" size={18} /></button>
        </span>
      ) : (
        <button type="button" className={page.iconButton} aria-label={`Alterar status de ${doc.filename}`} title="Alterar status" onClick={() => review(doc.id, doc.leadId, doc.status === "approved" ? "rejected" : "approved")}>
          <RefreshCw aria-hidden="true" size={18} />
        </button>
      ),
    },
  ];

  const emptyText = status === "pending" ? "Nenhum documento aguardando aprovação." : status === "approved" ? "Nenhum documento aprovado encontrado." : status === "rejected" ? "Nenhum documento rejeitado encontrado." : "Nenhum documento encontrado.";

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <Tabs defaultValue="queue" variant="segment" className={styles.tabs}>
        {canConfigure ? (
          <div className={styles.views}>
            <TabsList aria-label="Documentos" className="w-max">
              <TabsTrigger value="queue">Fila de aprovação</TabsTrigger>
              <TabsTrigger value="config">Configuração de requisitos</TabsTrigger>
            </TabsList>
          </div>
        ) : null}

        <TabsContent value="queue" className={styles.panel}>
          <div className={page.toolbar}>
            <label className={page.search}>
              <Search aria-hidden="true" size={18} className={page.searchIcon} />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por lead, documento ou tipo" aria-label="Buscar documentos" className={page.searchInput} />
            </label>
          </div>
          <LiteFilterChips
            label="Status dos documentos"
            scroll
            chips={[
              { id: "pending", label: "Pendentes", count: counts.pending },
              { id: "approved", label: "Aprovados", count: counts.approved },
              { id: "rejected", label: "Rejeitados", count: counts.rejected },
              { id: "all", label: "Todos", count: counts.all },
            ]}
            active={[status]}
            onToggle={(id) => setStatus(id as StatusFilter)}
          />
          {filtered.length === 0 ? (
            <div className={page.empty}>
              <h2 className={page.emptyTitle}>Tudo em dia</h2>
              <p className={page.emptyText}>{emptyText}</p>
            </div>
          ) : (
            <>
              <LiteResponsiveData
                caption="Documentos"
                columns={columns}
                rows={pageRows}
                rowKey={(doc) => doc.id}
                selection={{
                  isSelected: (doc) => multiSelect.isSelected(doc.id),
                  onToggle: (doc) => multiSelect.toggle(doc.id),
                  allSelected: multiSelect.isAllSelected,
                  onToggleAll: () => multiSelect.selectAll(),
                  rowLabel: (doc) => `Selecionar ${doc.leadNome}`,
                }}
                empty={<p>{emptyText}</p>}
              />
              <LitePagination label="Páginas de documentos" {...pagination} />
            </>
          )}
          <LiteBulkBar
            count={multiSelect.count}
            onClear={multiSelect.clear}
            actions={[
              { id: "approve", label: "Aprovar", onRun: () => bulkReview("approved") },
              { id: "reject", label: "Rejeitar", tone: "danger", onRun: () => bulkReview("rejected") },
            ]}
          />
        </TabsContent>

        {canConfigure ? (
        <TabsContent value="config" className={styles.panel}>
          <div className={styles.configGrid}>
            <section className={page.card} aria-labelledby="checklist">
              <header className={page.cardHead}>
                <h2 id="checklist" className={page.cardTitle}>Checklist de documentos</h2>
                <p className={page.cardDescription}>Requisitos de documentos obrigatórios por operadora e plano.</p>
              </header>
              {requirements.length === 0 ? (
                <div className={page.empty}><p className={page.emptyText}>Nenhum requisito de documento configurado.</p></div>
              ) : (
                <LiteResponsiveData
                  caption="Requisitos de documentos"
                  rows={requirements}
                  rowKey={(requirement) => requirement.id}
                  empty={<p>Nenhum requisito.</p>}
                  columns={[
                    { id: "name", label: "Documento", primary: true, render: (requirement) => <span><span className={page.cellTitle}>{requirement.name}</span>{requirement.description ? <span className={page.cellSub}>{requirement.description}</span> : null}</span> },
                    { id: "carrier", label: "Operadora", render: (requirement) => requirement.carrierName ?? "Todas" },
                    { id: "plan", label: "Plano", render: (requirement) => requirement.planName ?? "Todos" },
                    { id: "required", label: "Obrigatório", render: (requirement) => <span className={page.badge} data-tone={requirement.required ? "info" : undefined}>{requirement.required ? "Sim" : "Não"}</span> },
                    {
                      id: "delete",
                      label: "Ações",
                      numeric: true,
                      render: (requirement) => (
                        <button type="button" className={styles.iconDanger} aria-label={`Excluir requisito ${requirement.name}`} onClick={() => setDeleting(requirement)}>
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      ),
                    },
                  ]}
                />
              )}
            </section>

            <section className={page.card} aria-labelledby="novo-requisito">
              <header className={page.cardHead}>
                <h2 id="novo-requisito" className={page.cardTitle}>Novo requisito</h2>
                <p className={page.cardDescription}>Defina as regras de documentos obrigatórios.</p>
              </header>
              <form key={reqKey} ref={reqFormRef} action={reqAction} className={form.form}>
                <label className={form.field}>
                  <span className={form.label}>Nome do documento</span>
                  <input name="name" required className={form.input} placeholder="Ex.: RG ou CNH do titular" />
                </label>
                <label className={form.field}>
                  <span className={form.label}>Descrição ou instruções</span>
                  <input name="description" className={form.input} placeholder="Instruções para o corretor" />
                </label>
                <div className={form.field}>
                  <span className={form.label}>Operadora vinculada (opcional)</span>
                  <input type="hidden" name="carrierId" value={carrierId} />
                  <LiteSelect label="Operadora vinculada" hideLabel inline value={carrierId} onChange={setCarrierId} options={[{ value: "", label: "Todas as operadoras" }, ...carriers.map((carrier) => ({ value: carrier.id, label: carrier.name }))]} />
                </div>
                <div className={form.field}>
                  <span className={form.label}>Plano específico (opcional)</span>
                  <input type="hidden" name="planId" value={planId} />
                  <LiteSelect label="Plano específico" hideLabel inline value={planId} onChange={setPlanId} options={[{ value: "", label: "Todos os planos" }, ...plans.map((plan) => ({ value: plan.id, label: `${plan.carrierName} - ${plan.name}` }))]} />
                </div>
                <label className={form.check}>
                  <input type="checkbox" name="required" value="true" defaultChecked />
                  Este documento é obrigatório para fechamento
                </label>
                <label className={form.check}>
                  <input type="checkbox" name="appliesPerBeneficiary" value="true" />
                  Exigir este documento para cada beneficiário
                </label>
                <div className={form.actions}>
                  <button type="submit" className={page.primaryButton} disabled={reqPending}>{reqPending ? "Criando..." : "Criar requisito"}</button>
                </div>
              </form>
            </section>
          </div>
        </TabsContent>
        ) : null}
      </Tabs>

      <LiteConfirmDialog
        open={deleting !== null}
        title="Excluir este requisito?"
        description={deleting ? `"${deleting.name}" deixa de ser pedido nos próximos atendimentos.` : undefined}
        confirmLabel="Excluir requisito"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
