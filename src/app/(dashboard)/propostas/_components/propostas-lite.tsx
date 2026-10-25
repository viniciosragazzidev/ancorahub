"use client";

/**
 * /propostas no visual Lite do diretor. Mesmos dados, regras e ações da tela atual: números (abertas, volume mensal,
 * vencendo), visões Todas, Abertas e Expirando, lista Lite com copiar link público, troca de status, "Fechar venda"
 * e o selo de venda fechada; criar proposta e fechar venda em painel lateral (LiteSidePanel), com as mesmas Server
 * Actions e mensagens.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, Link2, Plus, ShieldCheck } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { convertProposalToSaleAction, createProposalAction, getQuotesForLeadAction, updateProposalStatusAction } from "@/features/proposals/actions";
import type { ProposalRecord } from "@/features/proposals/queries";
import type { ProposalStatus } from "@/shared/db/schema";

import { formatLeadPhone } from "@/features/leads/format-lead-phone";
import styles from "./propostas-lite.module.css";

/** Mesmos estados de hoje, com acentos e em sentence case. */
const STATUS: Record<ProposalStatus, { label: string; tone?: "success" | "warning" | "danger" | "info" }> = {
  rascunho: { label: "Rascunho" },
  em_revisao: { label: "Em revisão", tone: "warning" },
  enviada: { label: "Enviada", tone: "info" },
  visualizada: { label: "Visualizada", tone: "info" },
  negociacao: { label: "Negociação", tone: "info" },
  aprovada: { label: "Aprovada", tone: "success" },
  perdida: { label: "Perdida", tone: "danger" },
  expirada: { label: "Expirada" },
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

type PaymentMethod = "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro";
type RenewalType = "reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao";

export function PropostasLite({ initialProposals, expiringProposals, leads }: {
  initialProposals: ProposalRecord[];
  expiringProposals: ProposalRecord[];
  leads: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selected, setSelected] = useState<ProposalRecord | null>(null);
  const [leadId, setLeadId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [quotes, setQuotes] = useState<Array<{ id: string; title: string; totalMonthly: string }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string }>>([]);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("boleto");
  const [renewalType, setRenewalType] = useState<RenewalType>("reajuste_operadora");
  const [renewalContactPreference, setRenewalContactPreference] = useState("whatsapp");
  const [postSaleNotes, setPostSaleNotes] = useState("");

  const openProposals = proposals.filter((proposal) => !["aprovada", "perdida", "expirada"].includes(proposal.status));
  const totalValueOpen = openProposals.reduce((sum, proposal) => sum + Number(proposal.totalMonthly), 0);

  async function changeLead(nextLeadId: string) {
    setLeadId(nextLeadId);
    setQuoteId("");
    if (!nextLeadId) {
      setQuotes([]);
      setDocuments([]);
      return;
    }
    setLoading(true);
    try {
      const result = await getQuotesForLeadAction(nextLeadId);
      if (result.success && result.quotes && result.docs) {
        setQuotes(result.quotes);
        setDocuments(result.docs);
      } else {
        toast.error("Erro ao carregar dados do lead.");
      }
    } catch {
      toast.error("Erro na conexao com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("leadId", leadId);
    formData.set("quoteId", quoteId);
    formData.set("documentIds", JSON.stringify(attachedDocIds));
    startTransition(async () => {
      const result = await createProposalAction({}, formData);
      if (result.error) toast.error(result.error);
      else if (result.success && result.proposalId) {
        toast.success("Proposta criada com sucesso.");
        router.refresh();
      }
    });
  }

  async function changeStatus(proposalId: string, status: ProposalStatus) {
    const result = await updateProposalStatusAction(proposalId, status);
    if (result.success) {
      toast.success(`Status atualizado para ${STATUS[status].label}.`);
      setProposals((current) => current.map((proposal) => (proposal.id === proposalId ? { ...proposal, status } : proposal)));
    } else {
      toast.error(result.error || "Erro ao atualizar status.");
    }
  }

  function copyLink(proposalId: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/cotacao/${proposalId}`);
    toast.success("Link copiado para a area de transferencia.");
  }

  async function submitConvert() {
    if (!selected) return;
    if (!policyNumber || !coverageStartDate) {
      toast.error("Numero da apolice e data de vigencia sao obrigatorios.");
      return;
    }
    setLoading(true);
    const result = await convertProposalToSaleAction(selected.id, { policyNumber, coverageStartDate, paymentMethod, renewalType, renewalContactPreference, notes: postSaleNotes });
    setLoading(false);
    if (result.success) {
      toast.success("Proposta convertida em venda com sucesso!");
      setConvertOpen(false);
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao converter para venda.");
    }
  }

  const columns: LiteColumn<ProposalRecord>[] = [
    {
      id: "title",
      label: "Título",
      primary: true,
      render: (proposal) => (
        <span>
          <span className={page.cellTitle}>{proposal.title}</span>
          <span className={page.cellSub}>Versão {proposal.version}</span>
        </span>
      ),
    },
    {
      id: "lead",
      label: "Lead ou cliente",
      render: (proposal) => (
        <span>
          <span>{proposal.leadName}</span>
          <span className={`${page.cellSub} ${page.numeric}`}>{proposal.leadPhone ? formatLeadPhone(proposal.leadPhone) : "Sem telefone"}</span>
        </span>
      ),
    },
    { id: "status", label: "Status", render: (proposal) => <span className={page.badge} data-tone={STATUS[proposal.status]?.tone}>{STATUS[proposal.status]?.label ?? proposal.status}</span> },
    { id: "value", label: "Valor mensal", numeric: true, render: (proposal) => <span className={page.numeric}>{currency.format(Number(proposal.totalMonthly))}</span> },
    { id: "valid", label: "Validade", render: (proposal) => <span className={page.numeric}>{shortDate.format(new Date(proposal.validUntil))}</span> },
    {
      id: "actions",
      label: "Ações",
      render: (proposal) => (
        <span className={styles.actions}>
          <button type="button" className={styles.iconButton} aria-label={`Copiar link público de ${proposal.title}`} title="Copiar link público" onClick={() => copyLink(proposal.id)}>
            <Link2 aria-hidden="true" size={16} />
          </button>
          <span className={styles.statusSelect}>
            <LiteSelect label={`Status de ${proposal.title}`} hideLabel value={proposal.status} onChange={(value) => changeStatus(proposal.id, value as ProposalStatus)} options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label }))} />
          </span>
          {proposal.status === "aprovada" && !proposal.convertedSaleId ? (
            <button type="button" className={page.primaryButton} onClick={() => { setSelected(proposal); setConvertOpen(true); }}>
              <CheckCircle2 aria-hidden="true" size={16} /> Fechar venda
            </button>
          ) : null}
          {proposal.convertedSaleId ? <span className={page.badge} data-tone="success"><ShieldCheck aria-hidden="true" size={14} />&nbsp;Venda fechada</span> : null}
        </span>
      ),
    },
  ];

  const views = [
    { value: "todas", label: "Todas", rows: proposals },
    { value: "abertas", label: "Abertas", rows: openProposals },
    { value: "expirando", label: "Expirando", rows: expiringProposals },
  ];

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.stats} data-onboarding="quote-results">
        <Stat label="Abertas" value={String(openProposals.length)} hint="Propostas em negociação ou enviadas" />
        <Stat label="Volume mensal estimado" value={currency.format(totalValueOpen)} hint="Total das propostas abertas no funil" />
        <Stat label="Vencendo em breve" value={String(expiringProposals.length)} hint="Expiram nos próximos 7 dias" />
      </div>

      <Tabs defaultValue="todas" variant="segment" className={styles.tabs}>
        <div className={page.toolbar}>
          <div className={styles.views}>
            <TabsList aria-label="Propostas" className="w-max">
              {views.map((view) => <TabsTrigger key={view.value} value={view.value}>{view.label}<span className={styles.count}>{view.rows.length}</span></TabsTrigger>)}
            </TabsList>
          </div>
          <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} data-onboarding="generate-quote-pdf" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" size={16} /> Criar proposta
          </button>
        </div>
        {views.map((view) => (
          <TabsContent key={view.value} value={view.value} className={styles.panel}>
            <LiteResponsiveData caption={`Propostas: ${view.label}`} columns={columns} rows={view.rows} rowKey={(proposal) => proposal.id} empty={<p>Nenhuma proposta encontrada.</p>} />
          </TabsContent>
        ))}
      </Tabs>

      <LiteSidePanel open={createOpen} onOpenChange={setCreateOpen} title="Criar proposta comercial" description="Monte a proposta do lead com validade, cotação e documentos.">
        <form className={form.form} onSubmit={submitCreate} data-onboarding="quote-beneficiaries">
          <div className={form.field}>
            <span className={form.label}>Lead correspondente</span>
            <LiteSelect label="Lead correspondente" hideLabel inline value={leadId} onChange={changeLead} placeholder="Selecione um lead" options={[{ value: "", label: "Selecione um lead" }, ...leads.map((lead) => ({ value: lead.id, label: lead.name }))]} />
          </div>
          <label className={form.field}>
            <span className={form.label}>Título da proposta</span>
            <input name="title" required className={form.input} placeholder="Ex.: Proposta Bradesco Saúde Carlos" />
          </label>
          <div className={form.field}>
            <span className={form.label}>Cotação de origem (cálculo financeiro)</span>
            {loading || quotes.length === 0 ? (
              <p className={form.hint}>{loading ? "Carregando cotações..." : leadId ? "Nenhuma cotação criada para este lead ainda." : "Escolha o lead para ver as cotações."}</p>
            ) : (
              <LiteSelect label="Cotação de origem" hideLabel inline value={quoteId} onChange={setQuoteId} options={[{ value: "", label: "Nenhuma (proposta manual)" }, ...quotes.map((quote) => ({ value: quote.id, label: quote.title }))]} />
            )}
          </div>
          <label className={form.field}>
            <span className={form.label}>Data limite de validade</span>
            <input name="validUntil" type="date" required className={form.input} />
          </label>
          <label className={form.field}>
            <span className={form.label}>Observações comerciais</span>
            <textarea name="notes" className={form.textarea} placeholder="Condições específicas, descontos, regras de coparticipação" />
          </label>
          {documents.length > 0 ? (
            <div className={form.field}>
              <span className={form.label}>Anexar documentos cadastrais</span>
              <ul className={form.checks}>
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <label className={form.check}>
                      <input type="checkbox" checked={attachedDocIds.includes(doc.id)} onChange={() => setAttachedDocIds((current) => current.includes(doc.id) ? current.filter((id) => id !== doc.id) : [...current, doc.id])} />
                      {doc.filename}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={form.actions}>
            <button type="button" className={page.button} onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="submit" className={page.primaryButton} disabled={isPending || loading || !leadId}>{isPending ? "Salvando..." : "Criar proposta"}</button>
          </div>
        </form>
      </LiteSidePanel>

      <LiteSidePanel open={convertOpen} onOpenChange={setConvertOpen} title="Fechar venda da proposta" description="Informe a vigência e a apólice para converter a proposta em venda.">
        {selected ? (
          <div className={form.form}>
            <dl className={form.summary}>
              <div><dt>Proposta</dt><dd>{selected.title}</dd></div>
              <div><dt>Valor fechado</dt><dd className={page.numeric}>{currency.format(Number(selected.totalMonthly))}</dd></div>
            </dl>
            <label className={form.field}>
              <span className={form.label}>Número da apólice ou da proposta na operadora</span>
              <input value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} className={form.input} placeholder="Ex.: 8761238712" required />
            </label>
            <label className={form.field}>
              <span className={form.label}>Data de vigência</span>
              <input type="date" value={coverageStartDate} onChange={(event) => setCoverageStartDate(event.target.value)} className={form.input} required />
            </label>
            <div className={form.row}>
              <div className={form.field}>
                <span className={form.label}>Método de pagamento</span>
                <LiteSelect label="Método de pagamento" hideLabel inline value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={[{ value: "boleto", label: "Boleto" }, { value: "debito_automatico", label: "Débito automático" }, { value: "cartao_credito", label: "Cartão de crédito" }, { value: "desconto_folha", label: "Desconto em folha" }, { value: "outro", label: "Outro" }]} />
              </div>
              <div className={form.field}>
                <span className={form.label}>Regra de renovação</span>
                <LiteSelect label="Regra de renovação" hideLabel inline value={renewalType} onChange={(value) => setRenewalType(value as RenewalType)} options={[{ value: "reajuste_operadora", label: "Reajuste da operadora" }, { value: "portabilidade", label: "Portabilidade" }, { value: "manutencao", label: "Manutenção" }, { value: "nova_contratacao", label: "Nova contratação" }]} />
              </div>
            </div>
            <label className={form.field}>
              <span className={form.label}>Preferência de contato para renovação</span>
              <input value={renewalContactPreference} onChange={(event) => setRenewalContactPreference(event.target.value)} className={form.input} />
            </label>
            <label className={form.field}>
              <span className={form.label}>Observações de pós-venda (opcional)</span>
              <textarea value={postSaleNotes} onChange={(event) => setPostSaleNotes(event.target.value)} className={form.textarea} placeholder="Informações para a corretora ou para o faturamento" />
            </label>
            <div className={form.actions}>
              <button type="button" className={page.button} onClick={() => setConvertOpen(false)}>Cancelar</button>
              <button type="button" className={page.primaryButton} onClick={submitConvert} disabled={loading}>{loading ? "Convertendo..." : "Confirmar venda"}</button>
            </div>
          </div>
        ) : null}
      </LiteSidePanel>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={page.stat}>
      <span className={page.statLabel}>{label}</span>
      <span className={page.statValue}>{value}</span>
      <span className={page.statHint}>{hint}</span>
    </div>
  );
}
