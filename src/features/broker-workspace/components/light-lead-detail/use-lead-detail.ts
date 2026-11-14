"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { useSuccessOverlay } from "@/components/motion/success-overlay";
import { normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import { declineLeadAction } from "@/features/leads/decline-action";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { isAiPotentialSale } from "@/features/leads/ai-potential-sale";
import { LEAD_STATUS_ORDER } from "@/features/leads/lead-status-constants";
import { confirmDocumentUploadAction } from "@/features/documents/actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { brokerGreeting } from "@/features/leads/broker-greeting";
import { currentWhatsAppDevice, openWhatsApp, prepareWhatsAppWindow, watchWhatsAppLeave } from "@/lib/whatsapp-open";
import { onWhatsAppOpenFailed, takeWhatsAppHandoff, useAcceptHandoffEnabled, type WhatsAppHandoffPhase } from "@/features/broker-workspace/whatsapp-handoff/handoff-store";
import { quickReminderAction } from "@/features/leads/reminder-actions";
import { buildFollowUpWhen, type FollowUpOptionValue } from "@/features/broker-workspace/follow-up-options";
import { runOptimistic } from "@/lib/optimistic-core";
import { STEP_OPTIONS, type ConfirmationDocument, type LightLeadDetailData, type LiteRequirement } from "./types";

const STEP_ERROR_GENERIC = "Não deu para mudar a etapa agora. Tente de novo em instantes.";
/** Server reasons the broker can act on; anything else (internal or IA diagnosis) stays generic. */
const STEP_ERROR_REASONS = [
  "Inicie o atendimento antes",
  "Apenas o corretor responsável",
  "Este lead não está atribuído a você",
  "Transição inválida",
  "É obrigatório informar um motivo de perda",
  "A IA de Qualificação está ATIVADA",
  "Apenas gestores e diretores podem reabrir",
];

export function stepErrorMessage(error?: string) {
  if (error?.startsWith("PROTECAO_REGRESSAO_IA")) return "Esse lead parecia perto de fechar. Conte em poucas palavras por que ele voltou de etapa, com pelo menos 15 caracteres.";
  if (error && STEP_ERROR_REASONS.some((reason) => error.startsWith(reason))) return error;
  return STEP_ERROR_GENERIC;
}

/** All state and server-action handlers of the Light lead detail. Behavior is unchanged from the single-file version. */
export function useLeadDetail({
  lead,
  requirements,
  documents,
  initialDetailsExpanded = false,
}: {
  lead: LightLeadDetailData;
  requirements: LiteRequirement[];
  documents: ConfirmationDocument[];
  initialDetailsExpanded?: boolean;
}) {
    // Aceite é nível 1 (FEEDBACK.md): sem overlay; o nó continua exportado para quem ainda o monta.
    const { node: successOverlay } = useSuccessOverlay();
    const fire = useFeedback();
    const router = useRouter();
    const [accepted, setAccepted] = useState(lead.status !== "distributed" && lead.status !== "new");
    const [leadStatus, setLeadStatus] = useState(lead.status);
    const [detailsExpanded, setDetailsExpanded] = useState(initialDetailsExpanded);

    const [accepting, startAcceptTransition] = useTransition();
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [declineReason, setDeclineReason] = useState<string>("");
    const [declining, startDeclineTransition] = useTransition();

    const [showUpdateSheet, setShowUpdateSheet] = useState(false);
    const [selectedStep, setSelectedStep] = useState<string>("quote_sent");
    const [followupOption, setFollowupOption] = useState<FollowUpOptionValue>("tomorrow");
    const [customFollowupDate, setCustomFollowupDate] = useState("");
    const [observation, setObservation] = useState<string>("");
    const [lossReason, setLossReason] = useState<string>("preco");
    const [regressionJustification, setRegressionJustification] = useState<string>("");
    const [updatingStep, startUpdateTransition] = useTransition();

    // SLA Live Countdown calculation
    const [slaRemainingMinutes, setSlaRemainingMinutes] = useState<number | null>(null);

    useEffect(() => {
      if (leadStatus !== "distributed" && leadStatus !== "new") return;

      function updateSla() {
        const baseTime = lead.assignedAt ? new Date(lead.assignedAt).getTime() : new Date(lead.createdAt).getTime();
        const slaLimitMinutes = lead.slaFirstContactMinutes || 15;
        const elapsedMinutes = Math.floor((Date.now() - baseTime) / 60000);
        setSlaRemainingMinutes(slaLimitMinutes - elapsedMinutes);
      }

      updateSla();
      const interval = setInterval(updateSla, 30000);
      return () => clearInterval(interval);
    }, [lead.assignedAt, lead.createdAt, lead.slaFirstContactMinutes, leadStatus]);

    const potentialSaleCheck = useMemo(
      () => isAiPotentialSale(lead.aiIntelligence ? { aiIntelligence: lead.aiIntelligence } : lead),
      [lead],
    );

    const isSelectedStepRegression = useMemo(() => {
      const stepInfo = STEP_OPTIONS.find((s) => s.id === selectedStep);
      if (!stepInfo) return false;
      if (stepInfo.targetStatus === "lost") return true;
      return (LEAD_STATUS_ORDER[stepInfo.targetStatus] ?? 0) < (LEAD_STATUS_ORDER[leadStatus] ?? 0);
    }, [selectedStep, leadStatus]);

    const [whatsappOpenedAt, setWhatsappOpenedAt] = useState<string | null>(null);
    // Aceite com contador (11/11): o link do WhatsApp enquanto o quadro "Antes de chamar" está aberto.
    const handoffEnabled = useAcceptHandoffEnabled();
    const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
    // "failed": celular, o app não abriu no toque do aceite; o quadro já começa em "Toque para abrir o WhatsApp".
    const [handoffPhase, setHandoffPhase] = useState<WhatsAppHandoffPhase>("counting");
    useEffect(() => {
      // Aceite feito no Início, na lista ou no chat: o botão deixou o link para esta tela.
      if (!lead.isCurrentBroker) return;
      const handoff = takeWhatsAppHandoff(lead.id);
      if (handoff?.url) {
        setHandoffPhase(handoff.phase);
        setHandoffUrl(handoff.url);
      }
      // O aviso de "não abriu" pode chegar depois que esta tela montou (o aceite vigia por ~1,5 s).
      return onWhatsAppOpenFailed(lead.id, (url) => {
        setHandoffPhase("failed");
        setHandoffUrl(url);
      });
    }, [lead.id, lead.isCurrentBroker]);
    const [requestingSale, startRequestSaleTransition] = useTransition();
    const brokerIntro = lead.brokerGreeting || brokerGreeting({ leadName: lead.nome, brokerName: lead.corretorNome, tipo: lead.tipo, planName: lead.planName, livesCount: lead.livesCount, city: lead.city });
    const externalWhatsAppUrl = buildWhatsAppUrl(lead.telefone, brokerIntro);

    const [saleDocOpen, setSaleDocOpen] = useState(false);
    const [showSaleConfirm, setShowSaleConfirm] = useState(false);
    const [docRequirementId, setDocRequirementId] = useState("");
    const [docBeneficiaryId, setDocBeneficiaryId] = useState("");
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docObservation, setDocObservation] = useState("");
    const [isSaleClosing, setIsSaleClosing] = useState(true);

    const approvedDocument = useMemo(() => documents.find((d) => d.status === "approved"), [documents]);
    const rejectedDocument = useMemo(() => documents.find((d) => d.status === "rejected"), [documents]);

    const isDistributed = leadStatus === "distributed" || leadStatus === "new";

    function handleOpenUpdateModal() {
      if (leadStatus === "in_contact") setSelectedStep("quote_sent");
      else if (leadStatus === "quote_sent") setSelectedStep("negotiation");
      else setSelectedStep("quote_sent");

      setFollowupOption("tomorrow");
      setCustomFollowupDate("");
      setObservation("");
      setRegressionJustification("");
      setShowUpdateSheet(true);
    }

    function resetStepDialog() {
      setShowUpdateSheet(false);
      setObservation("");
      setRegressionJustification("");
      setCustomFollowupDate("");
    }


    // Handle Accept Lead: one tap accepts and opens the client's WhatsApp (the tab opens inside the click).
    function handleAccept() {
      if (accepting || accepted) return;
      fire("tap");
      const formData = new FormData();
      formData.append("leadId", lead.id);
      // Aceite com contador (11/11): ligado, nada abre no clique; o quadro conta 30 s e abre. Só no
      // computador (14/11): no celular o WhatsApp abre direto neste toque (sem toque recente o app não abre).
      const device = currentWhatsAppDevice();
      const counting = handoffEnabled && device === "desktop";
      const whatsapp = counting ? { go: () => false, cancel: () => {} } : prepareWhatsAppWindow(device);

      startAcceptTransition(async () => {
        let res;
        try {
          res = await startLeadServiceAction({}, formData);
        } catch {
          res = null;
        }

        if (!res?.success) {
          whatsapp.cancel();
          fire("error");
          toast.error(res?.error ? normalizeActionError({ error: res.error }, "Não deu para aceitar agora").cause : "Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou.");
          // The accept may have been recorded before the failure: the refresh shows the real state.
          router.refresh();
          return;
        }

        setAccepted(true);
        fire("confirm");
        setLeadStatus("in_contact");
        // The phone is not in the payload before acceptance: reload so WhatsApp and Ligar get it.
        router.refresh();

        const url = res.whatsappUrl;
        if (counting && url) {
          // O quadro "Antes de chamar" já confirma o aceite: sem overlay nem toast (LITE §7).
          setHandoffPhase("counting");
          setHandoffUrl(url);
          return;
        }
        // Celular: se a página continuar visível (o app não abriu), o quadro pede o toque.
        const leave = url && device === "mobile" ? watchWhatsAppLeave() : null;
        if (url && whatsapp.go(url)) {
          if (leave) void leave.then((outcome) => {
            if (outcome !== "failed") return;
            setHandoffPhase("failed");
            setHandoffUrl(url);
          });
          setWhatsappOpenedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
          toast.success("Lead aceito. Abrindo o WhatsApp do cliente.", { action: { label: "Abrir de novo", onClick: () => openWhatsApp(url) } });
        } else {
          whatsapp.cancel();
          toast.success("Lead aceito. Ele não tem WhatsApp no cadastro: use o telefone da ficha.");
        }
      });
    }

    // Handle Decline Lead
    function handleConfirmDecline() {
      if (declining || !declineReason) return;
      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("motivoRecusa", declineReason);

      startDeclineTransition(async () => {
        try {
          const res = await declineLeadAction(lead.id, declineReason);
          if (!res.success) {
            toast.error("Não deu para devolver o lead agora. Tente de novo em instantes.");
            return;
          }

          toast.info("Lead devolvido. Outro corretor assumirá o atendimento.");
          router.push("/minha-fila");
        } catch {
          toast.error("Não deu para devolver o lead agora. Tente de novo em instantes.");
        }
      });
    }

    // Handle Step Update Save
    function handleSaveStep() {
      if (updatingStep) return;

      const stepInfo = STEP_OPTIONS.find((s) => s.id === selectedStep);
      const targetStatus = stepInfo?.targetStatus || "in_contact";
      const shouldScheduleFollowup = selectedStep === "no_contact" || selectedStep === "quote_sent";
      const followupWhen = shouldScheduleFollowup
        ? buildFollowUpWhen(followupOption, customFollowupDate)
        : null;

      if (shouldScheduleFollowup && !followupWhen) {
        toast.error("Escolha uma data para o próximo acompanhamento.");
        return;
      }

      const formData = new FormData();
      formData.append("leadId", lead.id);
      formData.append("newStatus", targetStatus);
      formData.append("status", targetStatus);

      if (selectedStep === "no_interest" || selectedStep === "no_contact") {
        const reason =
          selectedStep === "no_contact" ? "sem_contato" : lossReason || "sem_interesse";
        formData.append("motivoPerda", reason);
        formData.append("lossReason", reason);
      }

      if (observation.trim()) formData.append("notes", observation);

      // Proteção de Regressão da IA
      if (potentialSaleCheck.isPotentialSale && isSelectedStepRegression) {
        if (regressionJustification.trim().length < 15) {
          toast.error(
            "Esse lead parecia perto de fechar. Conte em poucas palavras por que ele voltou de etapa, com pelo menos 15 caracteres.",
          );
          return;
        }
        formData.append("justificativaRegressao", regressionJustification.trim());
        formData.append("regressionJustification", regressionJustification.trim());
      }

      if (
        targetStatus === leadStatus &&
        selectedStep !== "no_interest" &&
        selectedStep !== "no_contact"
      ) {
        toast.info("O lead já está nesta etapa.");
        resetStepDialog();
        return;
      }

      // Resposta otimista (Doherty, 400 ms): a etapa muda e a folha fecha na hora, fora da transição
      // (estado de transição só aparece no fim). Se o servidor recusar, a etapa volta e a folha
      // reabre com o que o corretor escreveu, junto do aviso.
      const previousStatus = leadStatus;
      const change = runOptimistic({
        apply: () => {
          setLeadStatus(targetStatus);
          setShowUpdateSheet(false);
        },
        commit: () => changeLeadStatusAction({}, formData),
        rollback: () => {
          setLeadStatus(previousStatus);
          setShowUpdateSheet(true);
        },
        isSuccess: (res) => res.success === true,
      });

      startUpdateTransition(async () => {
        const outcome = await change;
        if (!outcome.ok) {
          toast.error(outcome.value ? stepErrorMessage(outcome.value.error) : STEP_ERROR_GENERIC);
          return;
        }
        resetStepDialog();
        if (followupWhen) {
          try {
            const reminderForm = new FormData();
            reminderForm.set("leadId", lead.id);
            reminderForm.set("when", followupWhen);
            const reminder = await quickReminderAction({}, reminderForm);
            if (!reminder.success) throw new Error("reminder");
          } catch {
            toast.warning("Etapa atualizada, mas não deu para marcar o acompanhamento.", {
              description: "Tente de novo em instantes ou marque o retorno pela ficha do lead.",
            });
            return;
          }
        }
        toast.success(followupWhen ? "Etapa e acompanhamento registrados." : "Etapa atualizada.");
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
            toast.error("O documento não subiu. Confira sua internet e o tamanho do arquivo e tente de novo.");
            return;
          }

          const statusFormData = new FormData();
          statusFormData.append("leadId", lead.id);
          statusFormData.append("newStatus", "documentation_pending");
          statusFormData.append("status", "documentation_pending");

          const statusRes = await changeLeadStatusAction({}, statusFormData);
          if (!statusRes.success) {
            toast.error("Não deu para enviar a venda para conferência. Seus documentos estão salvos; tente de novo.");
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
        } catch {
          toast.error("O documento não subiu. Confira sua internet e o tamanho do arquivo e tente de novo.");
        }
      });
    }

    const currentStepOption = STEP_OPTIONS.find((s) => s.id === selectedStep);

  return {
    accepted,
    leadStatus,
    handoffUrl,
    handoffPhase,
    closeHandoff: () => setHandoffUrl(null),
    /** After the sale is registered: the screen leaves "Confirmar venda" at once (no second tap). */
    markConverted: () => setLeadStatus("converted"),
    detailsExpanded,
    setDetailsExpanded,
    accepting,
    showDeclineModal,
    setShowDeclineModal,
    declineReason,
    setDeclineReason,
    declining,
    showUpdateSheet,
    setShowUpdateSheet,
    selectedStep,
    setSelectedStep,
    followupOption,
    setFollowupOption,
    customFollowupDate,
    setCustomFollowupDate,
    observation,
    setObservation,
    lossReason,
    setLossReason,
    regressionJustification,
    setRegressionJustification,
    updatingStep,
    slaRemainingMinutes,
    potentialSaleCheck,
    isSelectedStepRegression,
    whatsappOpenedAt,
    setWhatsappOpenedAt,
    requestingSale,
    externalWhatsAppUrl,
    saleDocOpen,
    setSaleDocOpen,
    showSaleConfirm,
    setShowSaleConfirm,
    docRequirementId,
    setDocRequirementId,
    docBeneficiaryId,
    setDocBeneficiaryId,
    docFile,
    setDocFile,
    docObservation,
    setDocObservation,
    isSaleClosing,
    setIsSaleClosing,
    approvedDocument,
    rejectedDocument,
    isDistributed,
    handleOpenUpdateModal,
    handleAccept,
    handleConfirmDecline,
    handleSaveStep,
    handleRequestSale,
    handleSubmitSaleDocument,
    currentStepOption,
    successOverlay: successOverlay,
  };
}

export type LeadDetailController = ReturnType<typeof useLeadDetail>;
