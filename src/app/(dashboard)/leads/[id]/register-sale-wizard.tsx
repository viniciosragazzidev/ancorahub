"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { useSuccessOverlay } from "@/components/motion/success-overlay";
import { AlertCircle, Info, Sparkles, XIcon } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { AppSelect } from "@/components/ui/select";
import { confirmDocumentUploadAction } from "@/features/documents/actions";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { ensureLeadHolderAction, registerSaleAction } from "@/features/post-sale/actions";
import { requiredDocumentsStillMissing } from "@/features/post-sale/sale-registration-v2-core";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";
import styles from "./register-sale-wizard.module.css";

type StepId = "people" | "plan" | "documents" | "review";
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "people", label: "Pessoas" },
  { id: "plan", label: "Plano" },
  { id: "documents", label: "Documentos" },
  { id: "review", label: "Revisão" },
];

const paymentOptions = [
  { value: "boleto", label: "Boleto" },
  { value: "debito_automatico", label: "Débito automático" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "desconto_folha", label: "Desconto em folha" },
  { value: "outro", label: "Outro" },
];
const renewalOptions = [
  { value: "reajuste_operadora", label: "Reajuste da operadora" },
  { value: "portabilidade", label: "Portabilidade" },
  { value: "manutencao", label: "Manutenção do plano" },
  { value: "nova_contratacao", label: "Nova contratação" },
];

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function dateFromKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : undefined;
}

function keyFromDate(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function personCountLabel(count: number): string {
  return `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
}

function requirementCountMessage(count: number): string {
  return count === 1
    ? "1 requisito ainda precisa ser aprovado. Você pode enviar o arquivo agora."
    : `${count} requisitos ainda precisam ser aprovados. Você pode enviar os arquivos agora.`;
}

function dateLabel(value: string) {
  if (!value) return "A definir";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = new Date(`${value}T12:00:00Z`);
  return !match || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? "A definir" : `${match[3]}/${match[2]}/${match[1]}`;
}

function currencyLabel(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount) : "A informar";
}

function documentStatusLabel(status: string | undefined) {
  if (status === "approved") return "Aprovado";
  if (status === "pending") return "Aguardando aprovação";
  if (status === "rejected") return "Precisa de correção";
  return "Falta enviar";
}

function requirementStatus(requirement: LiteRequirement, beneficiaryId: string | null, documents: ConfirmationDocument[]) {
  const matching = documents.filter((document) => document.requirementId === requirement.id && (!requirement.appliesPerBeneficiary || document.beneficiaryId === beneficiaryId));
  if (matching.some((document) => document.status === "approved")) return "approved";
  if (matching.some((document) => document.status === "pending")) return "pending";
  if (matching.some((document) => document.status === "rejected")) return "rejected";
  return undefined;
}

export function RegisterSaleWizard({
  lead,
  documents,
  requirements,
  carriers,
  open,
  onOpenChange,
  onRegistered,
  previewMode = false,
  previewMessage = null,
}: {
  lead: LightLeadDetailData;
  documents: ConfirmationDocument[];
  requirements: LiteRequirement[];
  carriers: CarrierOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered?: () => void;
  previewMode?: boolean;
  previewMessage?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { celebrate, node: successOverlay } = useSuccessOverlay();
  const [stepIndex, setStepIndex] = useState(0);
  const [policyNumber, setPolicyNumber] = useState("");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [contractTermMonths, setContractTermMonths] = useState(12);
  const [customExpirationDate, setCustomExpirationDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("boleto");
  const [renewalType, setRenewalType] = useState("reajuste_operadora");
  const [renewalContactPreference, setRenewalContactPreference] = useState("whatsapp");
  const [postSaleNotes, setPostSaleNotes] = useState("");
  const [approvedValue, setApprovedValue] = useState(lead.monthlyValue ?? "");
  const [carrierId, setCarrierId] = useState("");
  const [confirmationDocumentId, setConfirmationDocumentId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState(lead.beneficiaries?.find((person) => person.isHolder)?.id ?? "");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadObservation, setUploadObservation] = useState("");
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [blockingMessage, setBlockingMessage] = useState<string | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const people = useMemo(() => lead.beneficiaries ?? [], [lead.beneficiaries]);
  const holder = people.find((person) => person.isHolder);
  const selectedBeneficiaryId = people.some((person) => person.id === beneficiaryId)
    ? beneficiaryId
    : holder?.id ?? people[0]?.id ?? "";
  const beneficiariesVersion = people.map((person) => [person.id, person.name, person.birthDate ?? "", person.age ?? "", person.hasCpf ?? Boolean(person.cpf)].join(":")).join("|");
  const missingPeople = lead.livesCount == null ? 0 : Math.max(0, lead.livesCount - people.length);
  const computedExpirationDate = useMemo(() => customExpirationDate || addMonths(coverageStartDate, contractTermMonths), [customExpirationDate, coverageStartDate, contractTermMonths]);
  const coverageRangeLabel = coverageStartDate && computedExpirationDate ? `${dateLabel(coverageStartDate)} a ${dateLabel(computedExpirationDate)}` : "A definir";
  const approvedConfirmationDocuments = documents.filter((document) => document.status === "approved");
  const missingDocuments = requiredDocumentsStillMissing({ requirements, beneficiaries: people, documents });
  const hasApprovedConfirmation = approvedConfirmationDocuments.some((document) => document.id === confirmationDocumentId);
  const canConfirm = Boolean(
    holder && policyNumber.trim() && coverageStartDate && approvedValue && hasApprovedConfirmation && missingDocuments.length === 0,
  );

  // Com uma única confirmação aprovada, ela já vem escolhida: o seletor só aparece quando há mais de uma.
  const approvedContractDocuments = approvedConfirmationDocuments.filter((document) => document.category === "contratacao");
  const onlyApprovedConfirmationId = approvedContractDocuments.length === 1 ? approvedContractDocuments[0]!.id : "";
  useEffect(() => {
    if (onlyApprovedConfirmationId && !confirmationDocumentId) setConfirmationDocumentId(onlyApprovedConfirmationId);
  }, [onlyApprovedConfirmationId, confirmationDocumentId]);

  useEffect(() => {
    if (!open || previewMode) return;
    let cancelled = false;
    void ensureLeadHolderAction(lead.id).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) setSetupMessage(result.error);
      else {
        setSetupMessage(null);
        if ("created" in result && (result.created || ("updated" in result && result.updated))) router.refresh();
      }
    }).catch(() => {
      if (!cancelled) setSetupMessage("Não foi possível preparar o titular agora. Atualize os dados e tente de novo.");
    });
    return () => { cancelled = true; };
  }, [open, lead.id, router, previewMode]);

  function uploadDocument() {
    if (!uploadFile) return;
    startTransition(async () => {
      const body = new FormData();
      body.append("file", uploadFile);
      body.append("leadId", lead.id);
      try {
        const response = await fetch("/api/documents/upload", { method: "POST", body });
        const payload = await response.json().catch(() => null) as { error?: string; filename?: string; fileUrl?: string; storageKey?: string; mimeType?: string; sizeBytes?: number; checksumSha256?: string } | null;
        if (!response.ok || !payload?.fileUrl || !payload.filename) throw new Error(payload?.error || "O arquivo não foi enviado.");
        const saved = await confirmDocumentUploadAction({
          leadId: lead.id,
          requirementId: requirementId || null,
          beneficiaryId: selectedBeneficiaryId || null,
          filename: payload.filename,
          fileUrl: payload.fileUrl,
          storageKey: payload.storageKey,
          category: "contratacao",
          description: uploadObservation.trim() || "Confirmação/documento da venda",
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
          checksumSha256: payload.checksumSha256,
        });
        if ("error" in saved) throw new Error(saved.error);
        if (lead.status !== "converted" && lead.status !== "documentation_pending") {
          const statusData = new FormData();
          statusData.append("leadId", lead.id);
          statusData.append("newStatus", "documentation_pending");
          statusData.append("status", "documentation_pending");
          const changed = await changeLeadStatusAction({}, statusData);
          if (!changed.success) {
            toast.error("O documento foi enviado. Não foi possível mover a etapa para Documentação; atualize a página.");
            router.refresh();
            return;
          }
        }
        setUploadFile(null);
        setUploadObservation("");
        toast.success("Documento enviado para análise.", { description: "O registro da venda só libera depois da aprovação." });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar o documento. Tente novamente.");
      }
    });
  }

  function startDocumentUpload(nextRequirementId: string, nextBeneficiaryId: string | null) {
    setRequirementId(nextRequirementId);
    if (nextBeneficiaryId) setBeneficiaryId(nextBeneficiaryId);
    requestAnimationFrame(() => {
      uploadSectionRef.current?.scrollIntoView({ block: "nearest" });
      uploadSectionRef.current?.focus({ preventScroll: true });
    });
  }

  function confirmSale() {
    if (!canConfirm || pending) {
      setBlockingMessage(!hasApprovedConfirmation
        ? "Anexe a confirmação da operadora e aguarde a aprovação do gestor."
        : missingDocuments.length
          ? "Ainda faltam documentos obrigatórios aprovados. Confira a lista do passo Documentos."
          : "Confira os campos obrigatórios antes de confirmar.");
      return;
    }
    setBlockingMessage(null);
    startTransition(async () => {
      try {
        const result = await registerSaleAction({
          leadId: lead.id,
          policyNumber,
          coverageStartDate,
          contractTermMonths,
          expirationDate: computedExpirationDate || undefined,
          paymentMethod: paymentMethod as "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro",
          renewalType: renewalType as "reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao",
          renewalContactPreference,
          postSaleNotes: postSaleNotes.trim() || undefined,
          approvedValue,
          confirmationDocumentId,
          carrierId: carrierId || undefined,
        });
        if ("error" in result) {
          setBlockingMessage(result.error);
          return;
        }
        toast.success("Venda registrada. O ciclo de renovação já foi agendado.");
        celebrate("Venda registrada");
        onOpenChange(false);
        onRegistered?.();
        router.refresh();
      } catch {
        setBlockingMessage("Não foi possível confirmar o registro. Atualize a página para verificar antes de tentar novamente.");
      }
    });
  }

  // Cada passo começa do topo, mesmo que o anterior tenha sido rolado até o fim.
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [stepIndex]);

  function goNext() {
    setBlockingMessage(null);
    setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStepIndex(0);
      setSetupMessage(null);
    }
    onOpenChange(nextOpen);
  }

  const selectedRequirement = requirements.find((item) => item.id === requirementId);
  const visibleSetupMessage = previewMode ? previewMessage : setupMessage;
  const currentStep = STEPS[stepIndex]!;
  const requiredRequirements = requirements.filter((requirement) => requirement.required);
  const confirmationDocumentsPending = documents.some((document) => document.category === "contratacao" && document.status === "pending");
  const confirmationDocumentsRejected = documents.some((document) => document.category === "contratacao" && document.status === "rejected");
  const confirmationStatus = approvedConfirmationDocuments.length ? "approved" : confirmationDocumentsPending ? "pending" : confirmationDocumentsRejected ? "rejected" : undefined;
  const dateFormat = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

  function renderRequirement(requirement: LiteRequirement, personId: string | null) {
    const status = requirementStatus(requirement, personId, documents);
    const personName = personId ? people.find((person) => person.id === personId)?.name ?? "Pessoa" : null;
    return (
      <li key={`${requirement.id}-${personId ?? "lead"}`} className={styles.row}>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{requirement.name}</span>
          {personName ? <span className={styles.rowMeta}>{personName}</span> : null}
        </span>
        <span className={styles.rowSide}>
          <span className={styles.status} data-status={status ?? "missing"}>{documentStatusLabel(status)}</span>
          {status === undefined || status === "rejected" ? <button type="button" className={styles.inlineAction} onClick={() => startDocumentUpload(requirement.id, personId)}>{status === "rejected" ? "Corrigir" : "Enviar"}</button> : null}
        </span>
      </li>
    );
  }

  const review: Array<{ label: string; value: string; meta?: string }> = [
    { label: "Titular", value: holder?.name ?? lead.nome, meta: holder?.age != null ? `${holder.age} anos` : holder?.birthDate ? dateLabel(holder.birthDate) : "Idade não informada" },
    { label: "Pessoas no plano", value: people.length ? personCountLabel(people.length) : "Titular pendente", meta: people.filter((person) => !person.isHolder).map((person) => person.name).join(", ") || "Sem dependentes cadastrados" },
    { label: "Plano", value: lead.planName || "Plano do lead", meta: carriers.find((carrier) => carrier.id === carrierId)?.name || undefined },
    { label: "Mensalidade", value: currencyLabel(approvedValue) },
    { label: "Apólice ou contrato", value: policyNumber || "A informar" },
    { label: "Vigência", value: coverageRangeLabel },
    { label: "Pagamento", value: paymentOptions.find((option) => option.value === paymentMethod)?.label ?? "A informar" },
    { label: "Confirmação", value: approvedConfirmationDocuments.find((document) => document.id === confirmationDocumentId)?.filename || "Pendente de aprovação" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPopup className={`arc-venancor ${styles.popup}`}>
          <div className={styles.shell}>
            <header className={styles.head}>
              <div className={styles.headRow}>
                <div className={styles.titles}>
                  <DialogTitle className={styles.title}>Registrar venda</DialogTitle>
                  <DialogDescription className={styles.stepLabel}>Passo {stepIndex + 1} de {STEPS.length} · {currentStep.label}</DialogDescription>
                </div>
                <button type="button" className={styles.close} aria-label="Fechar" disabled={pending} onClick={() => handleOpenChange(false)}><XIcon aria-hidden="true" /></button>
              </div>
              <div role="progressbar" aria-label="Progresso do registro" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1} aria-valuetext={`Passo ${stepIndex + 1} de ${STEPS.length}: ${currentStep.label}`} className={styles.progress}>
                {STEPS.map((step, index) => <span key={step.id} data-done={index <= stepIndex ? "true" : undefined} />)}
              </div>
            </header>

            <div ref={bodyRef} className={styles.body}>
              {visibleSetupMessage ? <p role="status" className={styles.note}><Info aria-hidden="true" />{visibleSetupMessage}</p> : null}
              {stepIndex === 0 && lead.status === "converted" && lead.aiSalePrompt === "register" ? <p className={styles.note} data-tone="action"><Sparkles aria-hidden="true" />Venda detectada pela IA. Complete os dados e a aprovação da confirmação da operadora para registrar no pós-venda.</p> : null}
              {blockingMessage ? <p role="alert" className={styles.note} data-tone="danger"><AlertCircle aria-hidden="true" />{blockingMessage}</p> : null}

              {stepIndex === 0 ? (
                <section className={styles.step} aria-label="Pessoas">
                  <div className={styles.panel}>
                    <span className={styles.panelLabel}>Contato do titular</span>
                    <span className={styles.panelValue}>{lead.nome}</span>
                    <span className={styles.panelMeta}>{[lead.telefone || "Telefone não informado", lead.email || null].filter(Boolean).join(" · ")}</span>
                  </div>
                  {missingPeople > 0 ? <p role="status" className={styles.note}><Info aria-hidden="true" />O lead indica {lead.livesCount} vidas. {missingPeople === 1 ? "Falta cadastrar 1 pessoa" : "Faltam " + missingPeople + " pessoas para cadastrar"}, se fizerem parte da contratação.</p> : null}
                  <BeneficiariesSection key={lead.id + ":" + beneficiariesVersion} leadId={lead.id} contactName={lead.nome} initialBeneficiaries={people.map((person) => ({ ...person, age: person.age ?? null, cpf: person.cpf ?? null, hasCpf: person.hasCpf ?? Boolean(person.cpf) }))} onChanged={() => router.refresh()} embedded />
                  {!holder ? <p className={styles.note}><Info aria-hidden="true" />Os dados do titular estão sendo preparados. Se faltarem nascimento ou idade, complete nesta etapa.</p> : null}
                </section>
              ) : null}

              {stepIndex === 1 ? (
                <section className={styles.step} aria-label="Plano">
                  <div className={styles.panel}>
                    <span className={styles.panelLabel}>Plano do lead</span>
                    <span className={styles.panelValue}>{lead.planName || "Plano não informado no lead"}</span>
                  </div>
                  <div className={styles.group}>
                    <h3 className={styles.groupTitle}>Contrato</h3>
                    <div className={styles.fields}>
                      {carriers.length ? <label className={`${styles.field} ${styles.wide}`} htmlFor="sale-v2-carrier">Operadora<AppSelect id="sale-v2-carrier" value={carrierId} onValueChange={setCarrierId} placeholder="Selecione a operadora" triggerClassName={styles.control} options={carriers.map((carrier) => ({ value: carrier.id, label: carrier.name }))} /></label> : null}
                      <label className={styles.field} htmlFor="sale-v2-policy">Número da apólice ou contrato<input id="sale-v2-policy" className={styles.control} value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} placeholder="Ex.: 123456789" autoComplete="off" /></label>
                      <label className={styles.field} htmlFor="sale-v2-value">Mensalidade aprovada<CurrencyInput id="sale-v2-value" className={`${styles.control} ${styles.currency}`} value={approvedValue} onChange={setApprovedValue} placeholder="0,00" /></label>
                    </div>
                  </div>
                  <div className={styles.group}>
                    <h3 className={styles.groupTitle}>Vigência</h3>
                    <div className={styles.fields}>
                      <div className={styles.field}><DatePicker label="Início da vigência" value={dateFromKey(coverageStartDate)} onChange={(date) => setCoverageStartDate(keyFromDate(date))} locale="pt-BR" format={dateFormat} placeholder="Selecione uma data" /></div>
                      <div className={styles.field}><DatePicker label="Vencimento" value={dateFromKey(computedExpirationDate)} onChange={(date) => setCustomExpirationDate(keyFromDate(date))} locale="pt-BR" format={dateFormat} placeholder="Calculado pelo prazo" /></div>
                      <div className={`${styles.field} ${styles.wide}`}>
                        <span id="sale-v2-term-label">Prazo</span>
                        <SegmentedControl className={styles.segments} label="Prazo" value={String(contractTermMonths)} onValueChange={(value) => { setContractTermMonths(Number(value)); setCustomExpirationDate(""); }} options={[{ value: "12", label: "12 meses" }, { value: "24", label: "24 meses" }, { value: "36", label: "36 meses" }]} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.group}>
                    <h3 className={styles.groupTitle}>Pagamento e renovação</h3>
                    <div className={styles.fields}>
                      <label className={styles.field} htmlFor="sale-v2-payment">Forma de pagamento<AppSelect id="sale-v2-payment" value={paymentMethod} onValueChange={setPaymentMethod} triggerClassName={styles.control} options={paymentOptions} /></label>
                      <label className={styles.field} htmlFor="sale-v2-renewal">Renovação<AppSelect id="sale-v2-renewal" value={renewalType} onValueChange={setRenewalType} triggerClassName={styles.control} options={renewalOptions} /></label>
                      <div className={`${styles.field} ${styles.wide}`}>
                        <span>Contato para renovação</span>
                        <SegmentedControl className={styles.segments} label="Contato para renovação" value={renewalContactPreference} onValueChange={setRenewalContactPreference} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "phone", label: "Ligação" }, { value: "email", label: "E-mail" }]} />
                      </div>
                      <label className={`${styles.field} ${styles.wide}`} htmlFor="sale-v2-notes">Observações do pós-venda (opcional)<textarea id="sale-v2-notes" rows={3} className={`${styles.control} ${styles.textarea}`} value={postSaleNotes} onChange={(event) => setPostSaleNotes(event.target.value)} placeholder="Informações úteis para acompanhar este contrato" /></label>
                    </div>
                  </div>
                </section>
              ) : null}

              {stepIndex === 2 ? (
                <section className={styles.step} aria-label="Documentos">
                  <div className={styles.group}>
                    <ul className={styles.list}>
                      <li className={styles.row}>
                        <span className={styles.rowMain}>
                          <span className={styles.rowTitle}>Confirmação da operadora</span>
                          <span className={styles.rowMeta}>{confirmationStatus === "approved" ? "Pronta para o registro" : <>Libera o registro depois de aprovada. <button type="button" className={styles.link} onClick={() => router.refresh()}>Atualizar</button></>}</span>
                        </span>
                        <span className={styles.rowSide}>
                          <span className={styles.status} data-status={confirmationStatus ?? "missing"}>{documentStatusLabel(confirmationStatus)}</span>
                          {!confirmationStatus || confirmationStatus === "rejected" ? <button type="button" className={styles.inlineAction} onClick={() => startDocumentUpload("", null)}>{confirmationStatus === "rejected" ? "Corrigir" : "Enviar"}</button> : null}
                        </span>
                      </li>
                    </ul>
                    {approvedConfirmationDocuments.length > 0 && !onlyApprovedConfirmationId ? (
                      <label className={styles.field} htmlFor="sale-v2-confirmation">Confirmação aprovada<AppSelect id="sale-v2-confirmation" value={confirmationDocumentId} onValueChange={setConfirmationDocumentId} placeholder="Selecione o documento aprovado" triggerClassName={styles.control} options={approvedConfirmationDocuments.map((document) => ({ value: document.id, label: document.filename }))} /></label>
                    ) : null}
                  </div>

                  {requiredRequirements.length ? (
                    <div className={styles.group}>
                      <h3 className={styles.groupTitle}>Documentos obrigatórios</h3>
                      <ul className={styles.list}>
                        {requiredRequirements.flatMap((requirement) => requirement.appliesPerBeneficiary
                          ? people.map((person) => renderRequirement(requirement, person.id))
                          : [renderRequirement(requirement, null)])}
                      </ul>
                      {missingDocuments.length ? <p className={styles.rowMeta}>{requirementCountMessage(missingDocuments.length)}</p> : null}
                    </div>
                  ) : null}

                  <div ref={uploadSectionRef} tabIndex={-1} className={styles.upload}>
                    <h3 className={styles.groupTitle}>Enviar documento agora</h3>
                    {requirements.length ? <label className={styles.field} htmlFor="sale-v2-requirement">Tipo de documento<AppSelect id="sale-v2-requirement" value={requirementId} onValueChange={setRequirementId} placeholder="Confirmação da operadora" triggerClassName={styles.control} options={requirements.map((item) => ({ value: item.id, label: item.name }))} /></label> : null}
                    {selectedRequirement?.appliesPerBeneficiary ? <label className={styles.field} htmlFor="sale-v2-beneficiary">Pessoa do documento<AppSelect id="sale-v2-beneficiary" value={selectedBeneficiaryId} onValueChange={setBeneficiaryId} placeholder="Selecione a pessoa" triggerClassName={styles.control} options={people.map((person) => ({ value: person.id, label: person.name }))} /></label> : null}
                    <FileDropzone label="Arquivo" description="PDF, JPG ou PNG até 10 MB" note="Um arquivo por envio" accept="application/pdf,image/jpeg,image/png" multiple={false} maxFiles={1} maxSize={10 * 1024 * 1024} onFilesChange={(files) => setUploadFile(files[0] ?? null)} />
                    <label className={styles.field} htmlFor="sale-v2-observation">Observação (opcional)<input id="sale-v2-observation" className={styles.control} value={uploadObservation} onChange={(event) => setUploadObservation(event.target.value)} placeholder="Ex.: confirmação da operadora" /></label>
                    <Button type="button" variant="secondary" disabled={previewMode || pending || !uploadFile} onClick={uploadDocument}>{pending ? "Enviando…" : "Enviar para aprovação"}</Button>
                  </div>

                  {documents.length ? (
                    <div className={styles.group}>
                      <h3 className={styles.groupTitle}>Arquivos enviados</h3>
                      <ul className={styles.list}>
                        {documents.map((document) => (
                          <li key={document.id} className={styles.row}>
                            <span className={styles.rowMain}><span className={styles.rowTitle}>{document.filename}</span></span>
                            <span className={styles.status} data-status={document.status}>{documentStatusLabel(document.status)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {stepIndex === 3 ? (
                <section className={styles.step} aria-label="Revisão">
                  <ul className={styles.list}>
                    {review.map((item) => (
                      <li key={item.label} className={styles.row}>
                        <span className={styles.rowMeta}>{item.label}</span>
                        <span className={styles.rowMain} style={{ justifyItems: "end" }}>
                          <span className={styles.rowValue}>{item.value}</span>
                          {item.meta ? <span className={styles.rowMeta} style={{ textAlign: "right" }}>{item.meta}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {!canConfirm ? <p role="status" className={styles.note}><Info aria-hidden="true" />{!holder ? "Complete os dados do titular." : approvedConfirmationDocuments.length === 0 ? "Falta anexar e aprovar a confirmação da operadora." : !confirmationDocumentId ? "Selecione a confirmação da operadora já aprovada." : missingDocuments.length ? requirementCountMessage(missingDocuments.length) : "Preencha o número do contrato, a vigência e o valor aprovado."}</p> : null}
                </section>
              ) : null}
            </div>

            <footer className={styles.foot}>
              {stepIndex > 0 ? <Button type="button" variant="secondary" disabled={pending} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>Voltar</Button> : null}
              {stepIndex < STEPS.length - 1
                ? <Button type="button" className={styles.primary} onClick={goNext}>Continuar</Button>
                : <Button type="button" className={styles.primary} disabled={previewMode || pending || !canConfirm} onClick={confirmSale}>{pending ? "Registrando…" : "Confirmar registro"}</Button>}
            </footer>
          </div>
        </DialogPopup>
      </Dialog>
      {successOverlay}
    </>
  );
}
