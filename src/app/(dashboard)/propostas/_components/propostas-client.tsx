"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle,
  Clock,
  Link,
  ShieldCheck,
  Phone,
  CurrencyCircleDollar,
  Calendar,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSelect } from "@/components/ui/select";
import {
  createProposalAction,
  updateProposalStatusAction,
  convertProposalToSaleAction,
  getQuotesForLeadAction,
} from "@/features/proposals/actions";
import type { ProposalRecord } from "@/features/proposals/queries";
import type { ProposalStatus } from "@/shared/db/schema";

const statusLabel: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisao",
  enviada: "Enviada",
  visualizada: "Visualizada",
  negociacao: "Negociacao",
  aprovada: "Aprovada",
  perdida: "Perdida",
  expirada: "Expirada",
};

const statusBadgeStyles: Record<ProposalStatus, string> = {
  rascunho: "bg-secondary text-secondary-foreground border-transparent",
  em_revisao: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  enviada: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  visualizada: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  negociacao: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  aprovada: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  perdida: "bg-red-500/10 text-red-500 border-red-500/20",
  expirada: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

type PropostasClientProps = {
  initialProposals: ProposalRecord[];
  expiringProposals: ProposalRecord[];
  leads: Array<{ id: string; name: string }>;
};

export function PropostasClient({
  initialProposals,
  expiringProposals,
  leads,
}: PropostasClientProps) {
  const [proposals, setProposals] = useState<ProposalRecord[]>(initialProposals);
  const [createOpen, setCreateOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalRecord | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [quotes, setQuotes] = useState<Array<{ id: string; title: string; totalMonthly: string }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string }>>([]);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [loadingLeadData, setLoadingLeadData] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form values for sale conversion
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro"
  >("boleto");
  const [renewalType, setRenewalType] = useState<
    "reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao"
  >("reajuste_operadora");
  const [renewalContactPreference, setRenewalContactPreference] = useState("whatsapp");
  const [postSaleNotes, setPostSaleNotes] = useState("");

  // Statistics
  const openProposals = proposals.filter(
    (p) => !["aprovada", "perdida", "expirada"].includes(p.status)
  );
  const totalValueOpen = openProposals.reduce(
    (acc, p) => acc + Number(p.totalMonthly),
    0
  );

  // Handle lead selection during creation
  async function handleLeadChange(leadId: string) {
    setSelectedLeadId(leadId);
    if (!leadId) {
      setQuotes([]);
      setDocuments([]);
      return;
    }
    setLoadingLeadData(true);
    try {
      const result = await getQuotesForLeadAction(leadId);
      if (result.success && result.quotes && result.docs) {
        setQuotes(result.quotes);
        setDocuments(result.docs);
      } else {
        toast.error("Erro ao carregar dados do lead.");
      }
    } catch (e) {
      toast.error("Erro na conexao com o servidor.");
    } finally {
      setLoadingLeadData(false);
    }
  }

  // Handle proposal creation form submission
  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("documentIds", JSON.stringify(attachedDocIds));

    startTransition(async () => {
      const res = await createProposalAction({}, formData);
      if (res.error) {
        toast.error(res.error);
      } else if (res.success && res.proposalId) {
        toast.success("Proposta criada com sucesso.");
        window.location.reload();
      }
    });
  }

  // Toggle document attachment selection
  function toggleDocAttachment(docId: string) {
    setAttachedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  // Update status action helper
  async function handleStatusChange(proposalId: string, status: ProposalStatus) {
    const res = await updateProposalStatusAction(proposalId, status);
    if (res.success) {
      toast.success(`Status atualizado para ${statusLabel[status]}.`);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status } : p))
      );
    } else {
      toast.error(res.error || "Erro ao atualizar status.");
    }
  }

  // Copy proposal public link
  function copyProposalLink(proposalId: string) {
    const url = `${window.location.origin}/cotacao/${proposalId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a area de transferencia.");
  }

  // Convert to sale submit handler
  async function handleConvertSubmit() {
    if (!selectedProposal) return;
    if (!policyNumber || !coverageStartDate) {
      toast.error("Numero da apolice e data de vigencia sao obrigatorios.");
      return;
    }

    setLoadingLeadData(true);
    const res = await convertProposalToSaleAction(selectedProposal.id, {
      policyNumber,
      coverageStartDate,
      paymentMethod,
      renewalType,
      renewalContactPreference,
      notes: postSaleNotes,
    });

    setLoadingLeadData(false);
    if (res.success) {
      toast.success("Proposta convertida em venda com sucesso!");
      setConvertOpen(false);
      window.location.reload();
    } else {
      toast.error(res.error || "Erro ao converter para venda.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid gap-4 md:grid-cols-3" data-onboarding="quote-results">
        <Card className="border border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Abertas
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openProposals.length}</div>
            <p className="text-xs text-muted-foreground">Propostas em negociacao ou enviadas</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Volume Mensal Estimado
            </CardTitle>
            <CurrencyCircleDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalValueOpen)}
            </div>
            <p className="text-xs text-muted-foreground">Total das propostas abertas no funil</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vencendo em Breve
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringProposals.length}</div>
            <p className="text-xs text-muted-foreground">Expiram nos proximos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Tabs defaultValue="todas" className="w-full">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <TabsList className="bg-muted/40 p-1 rounded-lg">
              <TabsTrigger value="todas" className="text-xs px-3 py-1.5 rounded-md">
                Todas ({proposals.length})
              </TabsTrigger>
              <TabsTrigger value="abertas" className="text-xs px-3 py-1.5 rounded-md">
                Abertas ({openProposals.length})
              </TabsTrigger>
              <TabsTrigger value="expirando" className="text-xs px-3 py-1.5 rounded-md">
                Expirando ({expiringProposals.length})
              </TabsTrigger>
            </TabsList>

            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger
                render={
                  <Button size="sm" className="gap-2 text-xs" data-onboarding="generate-quote-pdf">
                    <Plus className="h-4 w-4" /> Criar Proposta
                  </Button>
                }
              />
              <SheetContent className="w-full sm:max-w-lg bg-background p-6">
                <SheetHeader className="pb-4 border-b border-border/40">
                  <SheetTitle>Criar Proposta Comercial</SheetTitle>
                  <SheetDescription>
                    Monte uma nova proposta para o lead selecionado definindo validade, cotacao e documentos.
                  </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4" data-onboarding="quote-beneficiaries">
                  <div className="space-y-1">
                    <Label htmlFor="leadId" className="text-xs">
                      Lead correspondente
                    </Label>
                    <AppSelect
                      id="leadId"
                      name="leadId"
                      required
                      onValueChange={handleLeadChange}
                      options={[
                        { value: "", label: "Selecione um lead..." },
                        ...leads.map((lead) => ({ value: lead.id, label: lead.name })),
                      ]}
                      triggerClassName="h-9 bg-background text-xs shadow-sm"
                      value={selectedLeadId}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="title" className="text-xs">
                      Titulo da proposta
                    </Label>
                    <Input
                      id="title"
                      name="title"
                      required
                      placeholder="Ex: Proposta Bradesco Saude Carlos"
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="quoteId" className="text-xs">
                      Cotacao de origem (calculo financeiro)
                    </Label>
                    <AppSelect
                      disabled={loadingLeadData || quotes.length === 0}
                      id="quoteId"
                      name="quoteId"
                      options={[
                        { value: "", label: "Nenhuma (criar proposta manual/zero)" },
                        ...quotes.map((quote) => ({ value: quote.id, label: quote.title })),
                      ]}
                      triggerClassName="h-9 bg-background text-xs shadow-sm"
                    />
                    {quotes.length === 0 && selectedLeadId && !loadingLeadData && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Nenhuma cotacao criada para este lead ainda.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="validUntil" className="text-xs">
                      Data limite de validade
                    </Label>
                    <Input
                      id="validUntil"
                      name="validUntil"
                      type="date"
                      required
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">
                      Observacoes comerciais
                    </Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Condicoes comerciais especificas, descontos, regras de coparticipacao..."
                      className="text-xs min-h-[80px]"
                    />
                  </div>

                  {documents.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Anexar documentos cadastrais</Label>
                      <ScrollArea className="h-[100px] rounded-md border border-border/40 p-2">
                        <div className="space-y-2">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`doc-${doc.id}`}
                                checked={attachedDocIds.includes(doc.id)}
                                onChange={() => toggleDocAttachment(doc.id)}
                                className="rounded border-input text-primary focus:ring-primary size-3.5"
                              />
                              <label
                                htmlFor={`doc-${doc.id}`}
                                className="text-[11px] font-medium text-foreground leading-none cursor-pointer"
                              >
                                {doc.filename}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <SheetFooter className="pt-4 border-t border-border/40 gap-2">
                    <Button
                      type="submit"
                      className="w-full text-xs h-9"
                      disabled={isPending || loadingLeadData}
                    >
                      {isPending ? "Salvando..." : "Criar Proposta"}
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          {["todas", "abertas", "expirando"].map((tab) => {
            const list =
              tab === "todas"
                ? proposals
                : tab === "abertas"
                  ? openProposals
                  : expiringProposals;

            return (
              <TabsContent key={tab} value={tab} className="mt-4">
                <Card className="border border-border/60 shadow-sm bg-card">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground uppercase tracking-wider font-semibold">
                            <th className="p-3">Titulo</th>
                            <th className="p-3">Lead / Cliente</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Valor Mensal</th>
                            <th className="p-3">Validade</th>
                            <th className="p-3 text-right">Acoes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {list.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                Nenhuma proposta encontrada.
                              </td>
                            </tr>
                          ) : (
                            list.map((proposal) => (
                              <tr key={proposal.id} className="hover:bg-muted/10 transition-colors">
                                <td className="p-3 font-semibold text-foreground">
                                  {proposal.title}
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    Versao {proposal.version}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="font-medium text-foreground">{proposal.leadName}</div>
                                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground text-[10px]">
                                    <Phone className="h-3 w-3" />
                                    {proposal.leadPhone ?? "Sem telefone"}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge className={statusBadgeStyles[proposal.status]} variant="outline">
                                    {statusLabel[proposal.status] ?? proposal.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right font-medium text-foreground">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(Number(proposal.totalMonthly))}
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                                    new Date(proposal.validUntil)
                                  )}
                                </td>
                                <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Copiar link publico"
                                    onClick={() => copyProposalLink(proposal.id)}
                                  >
                                    <Link className="h-3.5 w-3.5" />
                                  </Button>
                                  <AppSelect
                                    aria-label="Status da proposta"
                                    className="w-34"
                                    onValueChange={(value) => handleStatusChange(proposal.id, value as ProposalStatus)}
                                    options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))}
                                    size="sm"
                                    triggerClassName="h-7 rounded-md bg-background px-2 text-[10px] shadow-sm"
                                    value={proposal.status}
                                  />
                                  {proposal.status === "aprovada" && !proposal.convertedSaleId && (
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={() => {
                                        setSelectedProposal(proposal);
                                        setConvertOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" /> Fechar Venda
                                    </Button>
                                  )}
                                  {proposal.convertedSaleId && (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] h-7 px-2 flex inline-flex items-center gap-1">
                                      <ShieldCheck className="h-3.5 w-3.5" /> Venda fechada
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Convert proposal to sale Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogPopup className="sm:max-w-md bg-background p-6">
          <DialogHeader className="pb-4 border-b border-border/40">
            <DialogTitle>Fechar Venda de Proposta</DialogTitle>
            <DialogDescription>
              Insira os dados da vigencia e da apolice para converter esta proposta em venda.
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/20 p-3 border border-border/40">
                <div>
                  <span className="text-muted-foreground text-[10px]">Proposta</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedProposal.title}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Valor Fechado</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(selectedProposal.totalMonthly))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="policyNumber" className="text-xs">
                  Numero da Apolice / Proposta na Operadora
                </Label>
                <Input
                  id="policyNumber"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  placeholder="Ex: 8761238712"
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="coverageStartDate" className="text-xs">
                  Data de Vigencia
                </Label>
                <Input
                  id="coverageStartDate"
                  type="date"
                  value={coverageStartDate}
                  onChange={(e) => setCoverageStartDate(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="paymentMethod" className="text-xs">
                    Metodo de Pagamento
                  </Label>
                  <AppSelect
                    id="paymentMethod"
                    onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
                    options={[
                      { value: "boleto", label: "Boleto" },
                      { value: "debito_automatico", label: "Débito automático" },
                      { value: "cartao_credito", label: "Cartão de crédito" },
                      { value: "desconto_folha", label: "Desconto em folha" },
                      { value: "outro", label: "Outro" },
                    ]}
                    triggerClassName="h-9 bg-background text-xs shadow-sm"
                    value={paymentMethod}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="renewalType" className="text-xs">
                    Regra de Renovacao
                  </Label>
                  <AppSelect
                    id="renewalType"
                    onValueChange={(value) => setRenewalType(value as typeof renewalType)}
                    options={[
                      { value: "reajuste_operadora", label: "Reajuste da operadora" },
                      { value: "portabilidade", label: "Portabilidade" },
                      { value: "manutencao", label: "Manutenção" },
                      { value: "nova_contratacao", label: "Nova contratação" },
                    ]}
                    triggerClassName="h-9 bg-background text-xs shadow-sm"
                    value={renewalType}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="renewalContactPreference" className="text-xs">
                  Preferencia de Contato para Renovacao
                </Label>
                <Input
                  id="renewalContactPreference"
                  value={renewalContactPreference}
                  onChange={(e) => setRenewalContactPreference(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="postSaleNotes" className="text-xs">
                  Observações de Pos-Venda (opcional)
                </Label>
                <Textarea
                  id="postSaleNotes"
                  value={postSaleNotes}
                  onChange={(e) => setPostSaleNotes(e.target.value)}
                  placeholder="Informacoes para a corretora ou para faturamento..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border/40 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setConvertOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConvertSubmit}
              disabled={loadingLeadData}
            >
              {loadingLeadData ? "Convertendo..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
