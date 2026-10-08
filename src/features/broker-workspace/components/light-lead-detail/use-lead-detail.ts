"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { useSuccessOverlay } from "@/components/motion/success-overlay";
import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import { declineLeadAction } from "@/features/leads/decline-action";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { isAiPotentialSale } from "@/features/leads/ai-potential-sale";
import { LEAD_STATUS_ORDER } from "@/features/leads/lead-status-constants";
import { confirmDocumentUploadAction } from "@/features/documents/actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { quickReminderAction } from "@/features/leads/reminder-actions";
import { buildFollowUpWhen, type FollowUpOptionValue } from "@/features/broker-workspace/follow-up-options";
import { STEP_OPTIONS, type ConfirmationDocument, type LightLeadDetailData, type LiteRequirement } from "./types";

/** All state and server-action handlers of the Light lead detail. Behavior is unchanged from the single-file version. */
export function useLeadDetail({
  lead,
  requirements,
  documents,
}: {
  lead: LightLeadDetailData;
  requirements: LiteRequirement[];
  documents: ConfirmationDocument[];
}) {
    const { celebrate: celebrateSuccess, node: successOverlay } = useSuccessOverlay();
    const router = useRouter();
    const [accepted, setAccepted] = useState(lead.status !== "distributed" && lead.status !== "new");
    const [leadStatus, setLeadStatus] = useState(lead.status);
    const [detailsExpanded, setDetailsExpanded] = useState(false);

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
    const [requestingSale, startRequestSaleTransition] = useTransition();
    const brokerIntro = `Olá, ${lead.nome.split(" ")[0] || lead.nome}! Sou seu corretor e vou seguir com seu atendimento por aqui.`;
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
        celebrateSuccess("Lead aceito");
        setLeadStatus("in_contact");

        const firstName = lead.nome.split(" ")[0] || lead.nome;
        toast.success(`Lead aceito! Agora inicie o atendimento com ${firstName}.`, {
          action: {
            label: "Ver insights",
            onClick: () => {
              router.push(`/conversas/broker?leadId=${lead.id}`);
            },
          },
        });
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
            toast.error(res.error ?? "Não foi possível recusar o lead.");
            return;
          }

          toast.info("Lead devolvido. Outro corretor assumirá o atendimento.");
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
            "Proteção de Regressão IA: É obrigatório fornecer uma justificativa detalhada com no mínimo 15 caracteres.",
          );
          return;
        }
        formData.append("justificativaRegressao", regressionJustification.trim());
        formData.append("regressionJustification", regressionJustification.trim());
      }

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
          if (followupWhen) {
            const reminderForm = new FormData();
            reminderForm.set("leadId", lead.id);
            reminderForm.set("when", followupWhen);
            const reminder = await quickReminderAction({}, reminderForm);
            if (!reminder.success) {
              toast.warning("Etapa atualizada, mas não foi possível agendar o acompanhamento.", {
                description: reminder.error ?? "Tente criar o lembrete pelo painel do lead.",
              });
              resetStepDialog();
              return;
            }
          }
          toast.success(followupWhen ? "Etapa e acompanhamento registrados." : "Etapa atualizada.");
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

    const currentStepOption = STEP_OPTIONS.find((s) => s.id === selectedStep);

  return {
    accepted,
    leadStatus,
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
