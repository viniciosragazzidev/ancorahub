"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  Share,
  Sparkle,
  Users,
  WhatsappLogo,
  XCircle,
} from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import { declineLeadAction } from "@/features/leads/decline-action";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { cn } from "@/lib/utils";
import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";

export type LightLeadDetailData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string;
  qualificationStatus?: string | null;
  qualificationState?: string | null;
  corretorId?: string | null;
  corretorNome?: string | null;
  branchName?: string | null;
  planName?: string | null;
  carrierName?: string | null;
  livesCount?: number | null;
  city?: string | null;
  urgency?: string | null;
  summary?: string | null;
  createdAt: Date | string;
  isCurrentBroker: boolean;
  tipo?: string | null;
  origem?: string | null;
  sourceCampaign?: string | null;
  beneficiaries?: Array<{
    id: string;
    name: string;
    birthDate: string;
    relationship: string;
    isHolder: boolean;
  }>;
  formData?: Record<string, string | null> | null;
  consentimentoLgpd?: boolean;
};

const DECLINE_REASONS = [
  "Estou sem disponibilidade",
  "Estou com muitos atendimentos",
  "Lead fora do meu perfil",
  "Não consigo atender agora",
  "Outro",
];

const STEP_OPTIONS = [
  { id: "quote_sent", label: "Cotação enviada", description: "Cotação enviada para o cliente", targetStatus: "quote_sent" },
  { id: "negotiation", label: "Em negociação", description: "Negociando condições da proposta", targetStatus: "negotiation" },
  { id: "no_interest", label: "Sem interesse", description: "Cliente optou por não seguir", targetStatus: "lost" },
  { id: "no_contact", label: "Não consegui contato", description: "Sem retorno após tentativas", targetStatus: "lost" },
];

export function LightLeadDetail({ lead, brokerName }: { lead: LightLeadDetailData; brokerName: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(lead.status !== "distributed" && lead.status !== "new");
  const [leadStatus, setLeadStatus] = useState(lead.status);
  const [phoneUnlocked, setPhoneUnlocked] = useState(Boolean(accepted && lead.telefone));
  
  const [accepting, startAcceptTransition] = useTransition();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState(DECLINE_REASONS[0]);
  const [declining, startDeclineTransition] = useTransition();

  const [showUpdateSheet, setShowUpdateSheet] = useState(false);
  const [selectedStep, setSelectedStep] = useState<string>("quote_sent");
  const [followupOption, setFollowupOption] = useState<string>("tomorrow");
  const [observation, setObservation] = useState<string>("");
  const [lossReason, setLossReason] = useState<string>("Preço");
  const [saleSuccessAnim, setSaleSuccessAnim] = useState(false);
  const [updatingStep, startUpdateTransition] = useTransition();

  const [whatsappOpenedAt, setWhatsappOpenedAt] = useState<string | null>(null);
  const [requestingSale, startRequestSaleTransition] = useTransition();

  const isDistributed = leadStatus === "distributed" || leadStatus === "new";

  function handleOpenUpdateModal() {
    if (leadStatus === "in_contact") setSelectedStep("quote_sent");
    else if (leadStatus === "quote_sent") setSelectedStep("negotiation");
    else setSelectedStep("quote_sent");

    setObservation("");
    setShowUpdateSheet(true);
  }

  function resetStepDialog() {
    setShowUpdateSheet(false);
    setObservation("");
  }

  // Check if lead is unavailable for this broker
  if (!lead.isCurrentBroker && isDistributed === false) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-8 text-center">
        <Card variant="subtle" className="p-6 bg-card/95 border-dashed space-y-3">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <XCircle className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Este atendimento não está mais disponível</h2>
          <p className="text-xs text-muted-foreground">
            Este lead já foi direcionado para outro corretor ou concluído.
          </p>
          <div className="pt-2">
            <Button size="sm" render={<Link href="/minha-fila" />} className="w-full font-semibold">
              VER MEUS LEADS
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Handle Accept Lead
  function handleAccept() {
    if (accepting || accepted) return;
    const formData = new FormData();
    formData.append("leadId", lead.id);

    startAcceptTransition(async () => {
      let res;
      try {
        res = await startLeadServiceAction({}, formData);
      } catch {
        toast.error("Não foi possível aceitar o lead no momento.");
        return;
      }

      if (!res.success) {
        toast.error(res.error ?? "Não foi possível aceitar o lead.");
        return;
      }

      setAccepted(true);
      setLeadStatus("in_contact");
      setPhoneUnlocked(true);

      toast.success("Lead aceito! Você já pode iniciar o contato.");
    });
  }

  // Handle Decline Lead
  function handleConfirmDecline() {
    if (declining) return;
    const formData = new FormData();
    formData.append("leadId", lead.id);
    formData.append("motivoRecusa", declineReason);

    startDeclineTransition(async () => {
      try {
        const res = await declineLeadAction(lead.id, declineReason);
        if (!res.success) {
          toast.error(res.error ?? "Não foi possível recusar o lead.");
          return;
        }

        toast.info("Lead devolvido para a fila.");
        router.push("/minha-fila");
      } catch {
        toast.error("Não foi possível recusar no momento.");
      }
    });
  }

  const greetingName = lead.nome.split(" ")[0];
  const initialMsg = `Olá, ${greetingName}! Tudo bem? Sou ${brokerName.split(" ")[0]}, consultor responsável pelo seu atendimento.`;
  const waUrl = buildWhatsAppUrl(lead.telefone, initialMsg);

  // Handle Step Update Save
  function handleSaveStep() {
    if (updatingStep) return;

    const stepInfo = STEP_OPTIONS.find(s => s.id === selectedStep);
    const targetStatus = stepInfo?.targetStatus || "in_contact";

    const formData = new FormData();
    formData.append("leadId", lead.id);
    formData.append("newStatus", targetStatus);
    formData.append("status", targetStatus);

    if (selectedStep === "no_interest" || selectedStep === "no_contact") {
      const reason = selectedStep === "no_contact" ? "Sem contato / Não atende" : (lossReason || "Sem interesse");
      formData.append("motivoPerda", reason);
      formData.append("lossReason", reason);
    }

    if (observation.trim()) formData.append("notes", observation);

    startUpdateTransition(async () => {
      try {
        if (targetStatus === leadStatus && selectedStep !== "no_interest" && selectedStep !== "no_contact") {
          toast.info("O lead já está nesta etapa.");
          resetStepDialog();
          return;
        }

        const res = await changeLeadStatusAction({}, formData);
        resetStepDialog();

        if (!res.success) {
          toast.error(res.error ?? "Não foi possível atualizar a etapa.");
          return;
        }

        setLeadStatus(targetStatus);
        toast.success("Etapa atualizada.");
      } catch {
        resetStepDialog();
        toast.error("Não foi possível atualizar no momento.");
      }
    });
  }

  // Handle Request Sale - changes status to documentation_pending
  function handleRequestSale() {
    if (requestingSale) return;

    startRequestSaleTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("leadId", lead.id);
        formData.append("newStatus", "documentation_pending");
        formData.append("status", "documentation_pending");

        const res = await changeLeadStatusAction({}, formData);

        if (!res.success) {
          toast.error(res.error ?? "Não foi possível solicitar a venda.");
          return;
        }

        setLeadStatus("documentation_pending");
        toast.success("Solicitação de venda enviada!", {
          description: "Envie a documentação de comprovação da venda para o supervisor aprovar.",
          duration: 8000,
        });
      } catch {
        toast.error("Não foi possível solicitar a venda no momento.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 pb-24 sm:px-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <Link
          href="/minha-fila"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Meus Leads
        </Link>
        <ExperienceModeToggle variant="pill" />
      </div>

      {/* Sale Success Victory Animation Banner */}
      {saleSuccessAnim ? (
        <Card variant="subtle" className="p-4 bg-primary/10 border-primary/30 text-center space-y-2 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle className="size-6" />
          </div>
          <h3 className="text-base font-bold text-primary">✓ Venda registrada!</h3>
          <p className="text-xs text-muted-foreground">O atendimento foi concluído e registrado como venda realizada.</p>
        </Card>
      ) : null}

      {/* Main Lead Header Card */}
      <Card variant="subtle" className="p-5 bg-card/95 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge
            variant={isDistributed ? "warning" : accepted ? "outline" : "secondary"}
            className="text-[11px] font-bold"
          >
            {isDistributed ? "NOVO LEAD" : accepted ? "EM ATENDIMENTO" : "AGUARDANDO"}
          </Badge>

          {lead.urgency ? (
            <Badge variant="destructive" className="text-[10px] font-semibold">
              <Clock className="mr-1 size-3" />
              {lead.urgency}
            </Badge>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{lead.nome}</h1>
          {/* Phone Display: ONLY REVEALED AFTER ACCEPTANCE */}
          {phoneUnlocked && lead.telefone ? (
            <p className="mt-1 font-mono text-base font-semibold text-primary">{lead.telefone}</p>
          ) : isDistributed ? (
            <p className="mt-1 text-xs text-muted-foreground italic">
              Contato pessoal liberado após o aceite.
            </p>
          ) : null}
          {/* Email - always visible after acceptance */}
          {phoneUnlocked && lead.email ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <Share className="mr-1 size-3 inline" />
              {lead.email}
            </p>
          ) : null}
        </div>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Produto / Plano</span>
            <strong className="font-semibold text-foreground truncate block">{lead.planName || lead.carrierName || "Plano Familiar"}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Tipo de Lead</span>
            <strong className="font-semibold text-foreground truncate block">{lead.tipo === "PME" ? "PME (Pessoa Jurídica)" : "PF (Pessoa Física)"}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Origem</span>
            <strong className="font-semibold text-foreground truncate block">{lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook")}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Cidade / Filial</span>
            <strong className="font-semibold text-foreground truncate block">{lead.city || lead.branchName || "Não informada"}</strong>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-[11px]">Responsável</span>
            <strong className="font-semibold text-foreground truncate block">{lead.corretorNome || brokerName}</strong>
          </div>
        </div>

        {/* Lead Summary */}
        {lead.summary ? (
          <div className="rounded-xl border border-border/60 bg-card p-3 text-xs space-y-1">
            <span className="font-semibold text-primary uppercase text-[10px] tracking-wider block">Resumo do atendimento</span>
            <p className="text-muted-foreground leading-relaxed">{lead.summary}</p>
          </div>
        ) : null}

        {/* Action Buttons Container */}
        {isDistributed ? (
          /* State 1: BEFORE ACCEPTANCE */
          <div className="pt-2 space-y-2">
            <Button
              size="lg"
              disabled={accepting}
              onClick={handleAccept}
              className="w-full h-12 text-sm font-bold gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {accepting ? (
                <span>Aceitando...</span>
              ) : (
                <>
                  <CheckCircle className="size-5" />
                  ACEITAR LEAD
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={accepting}
              onClick={() => setShowDeclineModal(true)}
              className="w-full text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              RECUSAR
            </Button>
          </div>
        ) : (
          /* State 2: AFTER ACCEPTANCE / IN SERVICE */
          <div className="pt-2 space-y-3">
            <a
              href={waUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!waUrl) {
                  e.preventDefault();
                  toast.error("Telefone não disponível.");
                  return;
                }
                const nowStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                setWhatsappOpenedAt(nowStr);
              }}
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full h-12 text-sm font-bold gap-2.5 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center rounded-xl"
              )}
            >
              <WhatsappLogo className="size-5" />
              ABRIR NO WHATSAPP
            </a>

            {whatsappOpenedAt ? (
              <p className="text-center text-[11px] text-emerald-600 font-medium">
                ✓ Contato aberto às {whatsappOpenedAt}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Etapa atual</span>
                <strong className="text-xs font-semibold text-foreground">
                  {leadStatus === "in_contact" ? "Em atendimento" : leadStatus === "quote_sent" ? "Cotação enviada" : leadStatus === "negotiation" ? "Em negociação" : leadStatus === "converted" ? "Venda realizada" : leadStatus === "documentation_pending" ? "Documentação pendente" : "Contato iniciado"}
                </strong>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenUpdateModal}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                REGISTRAR ETAPA
                <ArrowRight className="size-3.5" />
              </Button>
            </div>

            {/* Sale Registration Button - only when not yet converted and not pending */}
            {leadStatus !== "converted" && leadStatus !== "lost" && leadStatus !== "documentation_pending" && (
              <Button
                size="sm"
                onClick={handleRequestSale}
                disabled={requestingSale}
                className="w-full text-xs font-bold gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <FileText className="size-4" />
                {requestingSale ? "Enviando..." : "REGISTRAR VENDA"}
              </Button>
            )}

            {/* Pending sale status */}
            {leadStatus === "documentation_pending" && (
              <div className="rounded-xl border border-amber-300/30 bg-amber-50 p-3 text-xs text-center">
                <p className="font-semibold text-amber-700">Documentação de venda pendente</p>
                <p className="mt-1 text-amber-600">Aguardando aprovação do supervisor.</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Pessoas da Contratação + Dados Organizados ──────────────────── */}
      {!isDistributed && (
        <div className="space-y-5">
          <BeneficiariesSection
            leadId={lead.id}
            contactName={lead.nome}
            initialBeneficiaries={lead.beneficiaries || []}
          />
          <PersonRecordDetails
            kind="lead"
            createdAt={new Date(lead.createdAt)}
            consentimentoLgpd={lead.consentimentoLgpd ?? false}
            dependents={(lead.beneficiaries || []).map((b) => ({
              id: b.id,
              name: b.name,
              birthDate: b.birthDate,
              relationship: b.relationship,
              isHolder: b.isHolder,
            }))}
            documentCount={0}
            formData={lead.formData ? {
              dependentes: lead.formData.dependentes,
              mediaIdades: lead.formData.mediaIdades,
              razaoSocial: lead.formData.razaoSocial,
              cnpj: lead.formData.cnpj,
              funcionarios: lead.formData.funcionarios,
            } : undefined}
          />
        </div>
      )}

      {/* Refuse Lead Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Por que você não pode atender este lead?</DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o motivo da recusa para que o sistema redistribua o lead para outro corretor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {DECLINE_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-xs font-medium cursor-pointer transition-colors",
                  declineReason === r ? "border-primary bg-primary/5 text-foreground" : "border-border/70 hover:bg-muted/40"
                )}
              >
                <span>{r}</span>
                <input
                  type="radio"
                  name="declineReason"
                  value={r}
                  checked={declineReason === r}
                  onChange={() => setDeclineReason(r)}
                  className="accent-primary"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={declining}
              onClick={() => setShowDeclineModal(false)}
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={declining}
              onClick={handleConfirmDecline}
              className="flex-1 text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {declining ? "Devolvendo lead..." : "CONFIRMAR RECUSA"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Update Step Sheet / Dialog */}
      <Dialog open={showUpdateSheet} onOpenChange={setShowUpdateSheet}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Como está o atendimento?</DialogTitle>
            <DialogDescription className="text-xs">
              Selecione a etapa atual do atendimento para manter seu acompanhamento em dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 py-2">
            {STEP_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  "flex items-start justify-between rounded-xl border p-3 text-xs cursor-pointer transition-colors",
                  selectedStep === opt.id ? "border-primary bg-primary/5 text-foreground" : "border-border/70 hover:bg-muted/40"
                )}
              >
                <div className="space-y-0.5">
                  <span className="font-semibold block">{opt.label}</span>
                  <span className="text-muted-foreground text-[11px] block">{opt.description}</span>
                </div>
                <input
                  type="radio"
                  name="stepOption"
                  value={opt.id}
                  checked={selectedStep === opt.id}
                  onChange={() => setSelectedStep(opt.id)}
                  className="mt-0.5 accent-primary"
                />
              </label>
            ))}

            {/* Conditional Follow-up date pickers */}
            {selectedStep === "no_contact" && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-muted/20 p-3 space-y-2 text-xs">
                <span className="font-semibold text-foreground block">Quando deseja tentar novamente?</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Mais tarde", "Amanhã", "Em 2 dias", "Escolher data"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFollowupOption(opt)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center",
                        followupOption === opt ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedStep === "quote_sent" && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-muted/20 p-3 space-y-2 text-xs">
                <span className="font-semibold text-foreground block">Quando deseja acompanhar novamente?</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Amanhã", "Em 2 dias", "Em 3 dias", "Escolher data"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFollowupOption(opt)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center",
                        followupOption === opt ? "border-primary bg-primary text-primary-foreground font-semibold" : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedStep === "negotiation" && (
              <div className="mt-3 space-y-1.5 text-xs">
                <span className="font-semibold text-foreground block">Deseja registrar uma observação? (Opcional)</span>
                <input
                  type="text"
                  placeholder="Ex: Cliente está comparando duas opções de operadoras"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
                />
              </div>
            )}

            {selectedStep === "no_interest" && (
              <div className="mt-3 space-y-1.5 text-xs">
                <span className="font-semibold text-foreground block">Por que o cliente não seguiu?</span>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <option value="Preço">Preço alto</option>
                  <option value="Já contratou">Já contratou com outro</option>
                  <option value="Desistiu">Desistiu de contratar</option>
                  <option value="Escolheu concorrente">Escolheu concorrente</option>
                  <option value="Sem interesse">Sem interesse</option>
                  <option value="Outro">Outro motivo</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={updatingStep}
              onClick={() => setShowUpdateSheet(false)}
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={updatingStep}
              onClick={handleSaveStep}
              className="flex-1 text-xs font-bold bg-primary text-primary-foreground"
            >
              {updatingStep ? "Salvando..." : "SALVAR"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
