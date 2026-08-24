"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
import { AppSelect } from "@/components/ui/select";
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
import { confirmDocumentUploadAction } from "@/features/documents/actions";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { PersonRecordDetails } from "@/features/customer-record/components/person-record-details";
import { RegisterSalePanel } from "@/app/(dashboard)/leads/[id]/register-sale-panel";

type ConfirmationDocument = { id: string; filename: string; status: string };
type CarrierOption = { id: string; name: string };

export type LiteRequirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesPerBeneficiary: boolean;
};

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
  {
    id: "quote_sent",
    label: "Cotação enviada",
    description: "Cotação enviada para o cliente",
    targetStatus: "quote_sent",
  },
  {
    id: "negotiation",
    label: "Em negociação",
    description: "Negociando condições da proposta",
    targetStatus: "negotiation",
  },
  {
    id: "no_interest",
    label: "Sem interesse",
    description: "Cliente optou por não seguir",
    targetStatus: "lost",
  },
  {
    id: "no_contact",
    label: "Não consegui contato",
    description: "Sem retorno após tentativas",
    targetStatus: "lost",
  },
];

export function LightLeadDetail({
  lead,
  brokerName,
  hasWahaConnected = false,
  requirements = [],
  documents = [],
  carriers = [],
}: {
  lead: LightLeadDetailData;
  brokerName: string;
  hasWahaConnected?: boolean;
  requirements?: LiteRequirement[];
  documents?: ConfirmationDocument[];
  carriers?: CarrierOption[];
}) {
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

  const [saleDocOpen, setSaleDocOpen] = useState(false);
  const [showSaleConfirm, setShowSaleConfirm] = useState(false);
  const [docRequirementId, setDocRequirementId] = useState("");
  const [docBeneficiaryId, setDocBeneficiaryId] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docObservation, setDocObservation] = useState("");
  const [isSaleClosing, setIsSaleClosing] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const approvedDocument = useMemo(() => documents.find((d) => d.status === "approved"), [documents]);
  const rejectedDocument = useMemo(() => documents.find((d) => d.status === "rejected"), [documents]);

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
          <h2 className="text-lg font-semibold text-foreground">
            Este atendimento não está mais disponível
          </h2>
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

  // Handle Step Update Save
  function handleSaveStep() {
    if (updatingStep) return;

    const stepInfo = STEP_OPTIONS.find((s) => s.id === selectedStep);
    const targetStatus = stepInfo?.targetStatus || "in_contact";

    const formData = new FormData();
    formData.append("leadId", lead.id);
    formData.append("newStatus", targetStatus);
    formData.append("status", targetStatus);

    if (selectedStep === "no_interest" || selectedStep === "no_contact") {
      const reason =
        selectedStep === "no_contact" ? "Sem contato / Não atende" : lossReason || "Sem interesse";
      formData.append("motivoPerda", reason);
      formData.append("lossReason", reason);
    }

    if (observation.trim()) formData.append("notes", observation);

    startUpdateTransition(async () => {
      try {
        if (
          targetStatus === leadStatus &&
          selectedStep !== "no_interest" &&
          selectedStep !== "no_contact"
        ) {
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

  // Open Sale Document Dialog - broker goes to documentation stage
  function handleRequestSale() {
    if (requestingSale) return;

    setDocRequirementId("");
    setDocBeneficiaryId(
      lead.beneficiaries?.find((b) => b.isHolder)?.id ?? lead.beneficiaries?.[0]?.id ?? "",
    );
    setDocFile(null);
    setDocObservation("");
    setIsSaleClosing(true);
    setSaleDocOpen(true);
  }

  // Upload sale documentation and move lead to documentation_pending
  function handleSubmitSaleDocument() {
    if (requestingSale) return;

    const beneficiaries = lead.beneficiaries ?? [];
    if (!docFile) {
      toast.error("Selecione um arquivo para enviar.");
      return;
    }
    if (beneficiaries.length === 0) {
      toast.error("Cadastre o titular ou dependentes antes de enviar documentos.");
      return;
    }
    const requirement = requirements.find((r) => r.id === docRequirementId) ?? null;
    if (requirement?.appliesPerBeneficiary && !docBeneficiaryId) {
      toast.error("Selecione o dono deste documento.");
      return;
    }

    startRequestSaleTransition(async () => {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("leadId", lead.id);

      try {
        const uploadRes = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorData = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorData?.error || "Erro no upload do documento.");
        }

        const data = await uploadRes.json();

        const res = await confirmDocumentUploadAction({
          leadId: lead.id,
          requirementId: requirement?.id ?? null,
          beneficiaryId: docBeneficiaryId || null,
          filename: data.filename,
          fileUrl: data.fileUrl,
          storageKey: data.storageKey,
          category: isSaleClosing ? "contratacao" : "outros",
          description: docObservation.trim() || null,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          checksumSha256: data.checksumSha256,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        const statusFormData = new FormData();
        statusFormData.append("leadId", lead.id);
        statusFormData.append("newStatus", "documentation_pending");
        statusFormData.append("status", "documentation_pending");

        const statusRes = await changeLeadStatusAction({}, statusFormData);
        if (!statusRes.success) {
          toast.error(statusRes.error ?? "Não foi possível solicitar a venda.");
          return;
        }

        setSaleDocOpen(false);
        setDocFile(null);
        setDocObservation("");
        setLeadStatus("documentation_pending");

        toast.success(isSaleClosing ? "Documento de venda enviado!" : "Documento enviado!", {
          description: isSaleClosing
            ? "Solicitação de venda enviada. Aguardando aprovação do supervisor."
            : "Envie os demais documentos de comprovação para o supervisor aprovar.",
          duration: 8000,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o documento.");
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
        <Card
          variant="subtle"
          className="p-4 bg-primary/10 border-primary/30 text-center space-y-2 animate-in fade-in zoom-in duration-300"
        >
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle className="size-6" />
          </div>
          <h3 className="text-base font-bold text-primary">✓ Venda registrada!</h3>
          <p className="text-xs text-muted-foreground">
            O atendimento foi concluído e registrado como venda realizada.
          </p>
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
              <Share className="mr-1 size-3" />
              {lead.email}
            </p>
          ) : null}
        </div>

        {/* Operational Overview Grid */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Produto / Plano</span>
            <strong className="font-semibold text-foreground truncate block">
              {lead.planName || lead.carrierName || "Plano Familiar"}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Tipo de Lead</span>
            <strong className="font-semibold text-foreground truncate block">
              {lead.tipo === "PJ" || lead.tipo === "PME" ? "PJ / PME (Pessoa Jurídica)" : "PF (Pessoa Física)"}
            </strong>
          </div>

          {phoneUnlocked && lead.email ? (
            <div className="col-span-2">
              <span className="text-muted-foreground block text-[11px]">E-mail</span>
              <strong className="font-semibold text-foreground truncate block">
                {lead.email}
              </strong>
            </div>
          ) : null}

          {lead.formData?.razaoSocial ? (
            <div className="col-span-2">
              <span className="text-muted-foreground block text-[11px]">Razão Social</span>
              <strong className="font-semibold text-foreground truncate block">
                {lead.formData.razaoSocial}
              </strong>
            </div>
          ) : null}

          {lead.formData?.cnpj ? (
            <div>
              <span className="text-muted-foreground block text-[11px]">CNPJ</span>
              <strong className="font-semibold text-foreground truncate block">
                {lead.formData.cnpj}
              </strong>
            </div>
          ) : null}

          <div>
            <span className="text-muted-foreground block text-[11px]">Origem / Campanha</span>
            <strong className="font-semibold text-foreground truncate block">
              {lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook / Meta")}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Cidade / Filial</span>
            <strong className="font-semibold text-foreground truncate block">
              {lead.city || lead.branchName || "Não informada"}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Data de Entrada</span>
            <strong className="font-semibold text-foreground truncate block">
              {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Consentimento LGPD</span>
            <strong className="font-semibold text-emerald-600 truncate block">
              ✓ Confirmado
            </strong>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground block text-[11px]">Responsável</span>
            <strong className="font-semibold text-foreground truncate block">
              {lead.corretorNome || brokerName}
            </strong>
          </div>
        </div>

        {/* Lead Summary */}
        {lead.summary ? (
          <div className="rounded-xl border border-border/60 bg-card p-3 text-xs space-y-1">
            <span className="font-semibold text-primary uppercase text-[10px] tracking-wider block">
              Resumo do atendimento
            </span>
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
            <Link
              href={`/conversas/broker?leadId=${lead.id}&draft=broker_intro`}
              onClick={(e) => {
                const nowStr = new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                setWhatsappOpenedAt(nowStr);

                const isMobile =
                  typeof window !== "undefined" &&
                  (window.matchMedia("(max-width: 768px)").matches ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                      navigator.userAgent,
                    ));

                if (isMobile && !hasWahaConnected) {
                  e.preventDefault();
                  const firstName = lead.nome.split(" ")[0] || lead.nome;
                  const initialMsg = `Olá, ${firstName}! Sou seu corretor e vou seguir com seu atendimento por aqui.`;
                  const waUrl = buildWhatsAppUrl(lead.telefone, initialMsg);

                  toast.info("Acesse pelo computador para conectar seu WhatsApp ao sistema e habilitar automações.", {
                    description: "Redirecionando para o aplicativo do WhatsApp...",
                    duration: 4000,
                  });

                  if (waUrl) {
                    setTimeout(() => {
                      window.location.href = waUrl;
                    }, 700);
                  }
                }
              }}
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full h-12 text-sm font-bold gap-2.5 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center rounded-xl",
              )}
            >
              <WhatsappLogo className="size-5" />
              ABRIR NO WHATSAPP
            </Link>

            {whatsappOpenedAt ? (
              <p className="text-center text-[11px] text-emerald-600 font-medium">
                ✓ Contato aberto às {whatsappOpenedAt}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
              <div>
                <span className="text-[11px] text-muted-foreground block">Etapa atual</span>
                <strong className="text-xs font-semibold text-foreground">
                  {leadStatus === "in_contact"
                    ? "Em atendimento"
                    : leadStatus === "quote_sent"
                      ? "Cotação enviada"
                      : leadStatus === "negotiation"
                        ? "Em negociação"
                        : leadStatus === "converted"
                          ? "Venda realizada"
                          : leadStatus === "documentation_pending"
                            ? "Documentação pendente"
                            : "Contato iniciado"}
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

            {/* Approved document - Release sale confirmation! */}
            {approvedDocument && leadStatus !== "converted" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="size-4" />
                  Documentação Aprovada pelo Supervisor!
                </div>
                <p className="text-xs text-muted-foreground">
                  O documento &quot;{approvedDocument.filename}&quot; foi aprovado. Confirme os dados da apólice para concluir a venda.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowSaleConfirm(true)}
                  className="w-full text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <FileText className="size-4" />
                  CONFIRMAR VENDA & CONVERTER
                </Button>
              </div>
            )}

            {/* Rejected document alert */}
            {!approvedDocument && rejectedDocument && leadStatus !== "converted" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-destructive">
                  <XCircle className="size-4" />
                  Documentação Rejeitada pelo Supervisor
                </div>
                <p className="text-xs text-muted-foreground">
                  O documento &quot;{rejectedDocument.filename}&quot; foi rejeitado. Reenvie a documentação corrigida.
                </p>
                <Button
                  size="sm"
                  onClick={handleRequestSale}
                  disabled={requestingSale}
                  className="w-full text-xs font-bold gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <FileText className="size-4" />
                  REENVIAR DOCUMENTAÇÃO
                </Button>
              </div>
            )}

            {/* Pending sale status */}
            {!approvedDocument && !rejectedDocument && leadStatus === "documentation_pending" && (
              <div className="rounded-xl border border-amber-300/30 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-center">
                <p className="font-semibold text-amber-700 dark:text-amber-400">Documentação de venda em análise</p>
                <p className="mt-1 text-amber-600 dark:text-amber-300">Aguardando aprovação do supervisor.</p>
              </div>
            )}

            {/* Regular Register Sale Button when no docs attached yet */}
            {!approvedDocument &&
              !rejectedDocument &&
              leadStatus !== "converted" &&
              leadStatus !== "lost" &&
              leadStatus !== "documentation_pending" && (
                <Button
                  size="sm"
                  onClick={handleRequestSale}
                  disabled={requestingSale}
                  className="w-full text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <FileText className="size-4" />
                  {requestingSale ? "Enviando..." : "REGISTRAR VENDA"}
                </Button>
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
            formData={
              lead.formData
                ? {
                    dependentes: lead.formData.dependentes,
                    mediaIdades: lead.formData.mediaIdades,
                    razaoSocial: lead.formData.razaoSocial,
                    cnpj: lead.formData.cnpj,
                    funcionarios: lead.formData.funcionarios,
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Refuse Lead Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Por que você não pode atender este lead?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o motivo da recusa para que o sistema redistribua o lead para outro
              corretor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {DECLINE_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-xs font-medium cursor-pointer transition-colors",
                  declineReason === r
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 hover:bg-muted/40",
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
                  selectedStep === opt.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 hover:bg-muted/40",
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
                <span className="font-semibold text-foreground block">
                  Quando deseja tentar novamente?
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Mais tarde", "Amanhã", "Em 2 dias", "Escolher data"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFollowupOption(opt)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center",
                        followupOption === opt
                          ? "border-primary bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-card text-muted-foreground",
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
                <span className="font-semibold text-foreground block">
                  Quando deseja acompanhar novamente?
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {["Amanhã", "Em 2 dias", "Em 3 dias", "Escolher data"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFollowupOption(opt)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors text-center",
                        followupOption === opt
                          ? "border-primary bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-card text-muted-foreground",
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
                <span className="font-semibold text-foreground block">
                  Deseja registrar uma observação? (Opcional)
                </span>
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
                <span className="font-semibold text-foreground block">
                  Por que o cliente não seguiu?
                </span>
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

      {/* Sale Documentation Dialog */}
      <Dialog open={saleDocOpen} onOpenChange={setSaleDocOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Documentação da venda</DialogTitle>
            <DialogDescription className="text-xs">
              Envie o documento de comprovação da venda para o supervisor aprovar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Tipo de documento */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Tipo de documento
              </span>
              <AppSelect
                value={docRequirementId}
                onValueChange={setDocRequirementId}
                placeholder={
                  requirements.length ? "Selecione o tipo de documento" : "Nenhum tipo configurado"
                }
                options={
                  requirements.length
                    ? requirements.map((req) => ({ value: req.id, label: req.name }))
                    : [{ value: "__none__", label: "Nenhum tipo configurado", disabled: true }]
                }
              />
            </div>

            {/* Dono do documento */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Dono do documento
              </span>
              <AppSelect
                value={docBeneficiaryId}
                onValueChange={setDocBeneficiaryId}
                placeholder="Selecione o titular ou dependente"
                options={(lead.beneficiaries ?? []).map((b) => ({
                  value: b.id,
                  label: b.isHolder ? `${b.name} (Titular)` : `${b.name} (Dependente)`,
                }))}
              />
              {(lead.beneficiaries ?? []).length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  Cadastre o titular ou dependentes antes de enviar documentos.
                </p>
              ) : null}
            </div>

            {/* Arquivo */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Arquivo (PDF, JPG ou PNG até 10 MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary"
              />
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Observação (opcional)
              </span>
              <input
                type="text"
                placeholder="Ex: Contrato assinado pelo titular"
                value={docObservation}
                onChange={(e) => setDocObservation(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
              />
            </div>

            {/* Fechamento de venda */}
            <label className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isSaleClosing}
                onChange={(e) => setIsSaleClosing(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-semibold text-foreground block">
                  Este documento é o fechamento da venda
                </span>
                <span className="text-muted-foreground text-[11px] block">
                  Marque para registrar como documento de venda e enviar para aprovação do
                  supervisor.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={requestingSale}
              onClick={() => setSaleDocOpen(false)}
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={requestingSale || !docFile || (lead.beneficiaries ?? []).length === 0}
              onClick={handleSubmitSaleDocument}
              className="flex-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {requestingSale ? "Enviando..." : "ENVIAR DOCUMENTAÇÃO"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>

      <RegisterSalePanel
        leadId={lead.id}
        documents={documents}
        carriers={carriers}
        open={showSaleConfirm}
        onOpenChange={setShowSaleConfirm}
      />
    </div>
  );
}
