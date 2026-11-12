"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { useSuccessOverlay } from "@/components/motion/success-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogDescription, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { confirmDocumentUploadAction } from "@/features/documents/actions";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { BeneficiariesSection } from "@/app/(dashboard)/leads/[id]/beneficiaries-section";
import { ensureLeadHolderAction, registerSaleAction } from "@/features/post-sale/actions";
import { requiredDocumentsStillMissing } from "@/features/post-sale/sale-registration-v2-core";
import type { CarrierOption, ConfirmationDocument, LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";

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
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "A definir" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(date);
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

  const people = useMemo(() => lead.beneficiaries ?? [], [lead.beneficiaries]);
  const holder = people.find((person) => person.isHolder);
  const selectedBeneficiaryId = people.some((person) => person.id === beneficiaryId)
    ? beneficiaryId
    : holder?.id ?? people[0]?.id ?? "";
  const beneficiariesVersion = people.map((person) => [person.id, person.name, person.birthDate ?? "", person.age ?? "", person.hasCpf ?? Boolean(person.cpf)].join(":")).join("|");
  const missingPeople = lead.livesCount == null ? 0 : Math.max(0, lead.livesCount - people.length);
  const computedExpirationDate = useMemo(() => customExpirationDate || addMonths(coverageStartDate, contractTermMonths), [customExpirationDate, coverageStartDate, contractTermMonths]);
  const approvedConfirmationDocuments = documents.filter((document) => document.status === "approved");
  const missingDocuments = requiredDocumentsStillMissing({ requirements, beneficiaries: people, documents });
  const hasApprovedConfirmation = approvedConfirmationDocuments.some((document) => document.id === confirmationDocumentId);
  const canConfirm = Boolean(
    holder && policyNumber.trim() && coverageStartDate && approvedValue && hasApprovedConfirmation && missingDocuments.length === 0,
  );

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

  function renderRequirement(requirement: LiteRequirement, personId: string | null) {
    const status = requirementStatus(requirement, personId, documents);
    const personName = personId ? people.find((person) => person.id === personId)?.name ?? "Pessoa" : null;
    return (
      <div key={`${requirement.id}-${personId ?? "lead"}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="min-w-0">{requirement.name}{personName ? ` · ${personName}` : ""}</span>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={status === "approved" ? "secondary" : "outline"}>{documentStatusLabel(status)}</Badge>
          {status === undefined || status === "rejected" ? <Button type="button" variant="outline" className="min-h-11" onClick={() => startDocumentUpload(requirement.id, personId)}>{status === "rejected" ? "Corrigir" : "Enviar"}</Button> : null}
        </div>
      </div>
    );
  }
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPopup className="max-h-[min(92dvh,52rem)] w-[calc(100vw_-_1rem)] max-w-3xl overflow-y-auto sm:w-full">
          <DialogPanel className="space-y-5 p-1 sm:p-2">
            <header className="space-y-1">
              <DialogTitle className="text-xl font-semibold">Registrar venda</DialogTitle>
              <DialogDescription>Revise os dados, envie o que falta e conclua o registro em quatro passos.</DialogDescription>
            </header>

            <nav aria-label="Etapas do registro da venda" className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="font-medium">Passo {stepIndex + 1} de {STEPS.length} · {currentStep.label}</p>
                <span className="text-xs text-muted-foreground">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
              </div>
              <div role="progressbar" aria-label="Progresso do registro" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1} aria-valuetext={`Passo ${stepIndex + 1} de ${STEPS.length}: ${currentStep.label}`} className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary " style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
              </div>
            </nav>

            {visibleSetupMessage ? <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{visibleSetupMessage}</p> : null}
            {stepIndex === 0 && lead.status === "converted" && lead.aiSalePrompt === "register" ? <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">Venda detectada pela IA. Complete os dados e a aprovação da confirmação da operadora para registrar no pós-venda.</p> : null}
            {blockingMessage ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{blockingMessage}</p> : null}

            {stepIndex === 0 ? (
              <section className="space-y-4">
                <header className="space-y-1">
                  <h2 className="text-base font-semibold">Quem fará parte do plano</h2>
                  <p className="text-sm text-muted-foreground">O contato do lead é usado como titular. Confira idade, CPF e dependentes antes de avançar.</p>
                </header>
                <div className="grid gap-2 border-b border-border pb-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Contato do titular</p><p className="mt-1 font-medium">{lead.nome}</p><p className="text-xs text-muted-foreground">{lead.telefone || "Telefone não informado"}</p></div>
                  <div><p className="text-xs text-muted-foreground">E-mail</p><p className="mt-1 break-all font-medium">{lead.email || "Não informado"}</p></div>
                </div>
                {missingPeople > 0 ? <p role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">O lead indica {lead.livesCount} vidas. {missingPeople === 1 ? "Falta cadastrar 1 pessoa" : "Faltam " + missingPeople + " pessoas para cadastrar"}, se fizerem parte da contratação.</p> : null}
                <BeneficiariesSection key={lead.id + ":" + beneficiariesVersion} leadId={lead.id} contactName={lead.nome} initialBeneficiaries={people.map((person) => ({ ...person, age: person.age ?? null, cpf: person.cpf ?? null, hasCpf: person.hasCpf ?? Boolean(person.cpf) }))} onChanged={() => router.refresh()} />
                {!holder ? <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Os dados do titular estão sendo preparados. Se faltarem nascimento ou idade, complete nesta etapa.</p> : null}
              </section>
            ) : null}

            {stepIndex === 1 ? (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-base">Plano e condições da venda</CardTitle><CardDescription>O plano selecionado no lead é mantido. Informe os dados finais aprovados.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Plano do lead</Label><div className="flex min-h-11 items-center rounded-xl border border-border bg-muted/30 px-3 text-sm">{lead.planName || "Plano não informado no lead"}</div></div>
                  {carriers.length ? <div className="space-y-1.5"><Label htmlFor="sale-v2-carrier">Operadora</Label><AppSelect id="sale-v2-carrier" value={carrierId} onValueChange={setCarrierId} placeholder="Selecione a operadora" triggerClassName="min-h-11" options={carriers.map((carrier) => ({ value: carrier.id, label: carrier.name }))} /></div> : null}
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-policy">Número da apólice ou contrato</Label><Input id="sale-v2-policy" className="min-h-11" value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} placeholder="Ex.: 123456789" /></div>
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-value">Mensalidade aprovada</Label><CurrencyInput id="sale-v2-value" className="min-h-11" value={approvedValue} onChange={setApprovedValue} placeholder="0,00" /></div>
                  <div className="space-y-1.5"><DatePicker label="Início da vigência" value={dateFromKey(coverageStartDate)} onChange={(date) => setCoverageStartDate(keyFromDate(date))} locale="pt-BR" format={{ day: "2-digit", month: "2-digit", year: "numeric" }} placeholder="Selecione uma data" /></div>
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-term">Prazo</Label><AppSelect id="sale-v2-term" value={String(contractTermMonths)} onValueChange={(value) => setContractTermMonths(Number(value))} triggerClassName="min-h-11" options={[{ value: "12", label: "12 meses" }, { value: "24", label: "24 meses" }, { value: "36", label: "36 meses" }]} /></div>
                  <div className="space-y-1.5"><DatePicker label="Vencimento" value={dateFromKey(computedExpirationDate)} onChange={(date) => setCustomExpirationDate(keyFromDate(date))} locale="pt-BR" format={{ day: "2-digit", month: "2-digit", year: "numeric" }} placeholder="Selecione uma data" /></div>
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-payment">Forma de pagamento</Label><AppSelect id="sale-v2-payment" value={paymentMethod} onValueChange={setPaymentMethod} triggerClassName="min-h-11" options={paymentOptions} /></div>
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-renewal">Renovação</Label><AppSelect id="sale-v2-renewal" value={renewalType} onValueChange={setRenewalType} triggerClassName="min-h-11" options={renewalOptions} /></div>
                  <div className="space-y-1.5"><Label htmlFor="sale-v2-contact">Contato para renovação</Label><AppSelect id="sale-v2-contact" value={renewalContactPreference} onValueChange={setRenewalContactPreference} triggerClassName="min-h-11" options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "phone", label: "Ligação" }, { value: "email", label: "E-mail" }]} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sale-v2-notes">Observações do pós-venda</Label><Textarea id="sale-v2-notes" rows={3} value={postSaleNotes} onChange={(event) => setPostSaleNotes(event.target.value)} placeholder="Informações úteis para acompanhar este contrato" /></div>
                </CardContent>
              </Card>
            ) : null}

            {stepIndex === 2 ? (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><CardTitle className="text-base">Documentos da venda</CardTitle><CardDescription>A confirmação da operadora continua obrigatória e precisa estar aprovada.</CardDescription></div>
                    <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>Atualizar aprovação</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!approvedConfirmationDocuments.length ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="min-w-0"><p className="font-medium">Confirmação da operadora</p><p className="mt-1">{confirmationDocumentsPending ? "Aguardando aprovação" : confirmationDocumentsRejected ? "Precisa de correção" : "Falta enviar"}. O registro da venda libera depois da aprovação.</p></div>
                      {!confirmationDocumentsPending ? <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => startDocumentUpload("", null)}>{confirmationDocumentsRejected ? "Corrigir" : "Enviar"}</Button> : null}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="sale-v2-confirmation">Confirmação aprovada</Label>
                    <AppSelect id="sale-v2-confirmation" value={confirmationDocumentId} onValueChange={setConfirmationDocumentId} placeholder="Selecione o documento aprovado" triggerClassName="min-h-11" options={approvedConfirmationDocuments.map((document) => ({ value: document.id, label: document.filename }))} />
                  </div>
                  {requiredRequirements.length ? (
                    <div className="space-y-3 rounded-xl border border-border p-3">
                      <p className="text-sm font-medium">Documentos obrigatórios</p>
                      {requiredRequirements.flatMap((requirement) => requirement.appliesPerBeneficiary
                        ? people.map((person) => renderRequirement(requirement, person.id))
                        : [renderRequirement(requirement, null)])}
                    </div>
                  ) : null}
                  {missingDocuments.length ? <p className="text-sm text-muted-foreground">{requirementCountMessage(missingDocuments.length)}</p> : null}
                  <div ref={uploadSectionRef} tabIndex={-1} className="space-y-3 rounded-xl border border-dashed border-border p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="text-sm font-medium">Enviar documento agora</p>
                    {requirements.length ? <div className="space-y-1.5"><Label htmlFor="sale-v2-requirement">Tipo de documento</Label><AppSelect id="sale-v2-requirement" value={requirementId} onValueChange={setRequirementId} placeholder="Confirmação da operadora" triggerClassName="min-h-11" options={requirements.map((item) => ({ value: item.id, label: item.name }))} /></div> : null}
                    {selectedRequirement?.appliesPerBeneficiary ? <div className="space-y-1.5"><Label htmlFor="sale-v2-beneficiary">Pessoa do documento</Label><AppSelect id="sale-v2-beneficiary" value={selectedBeneficiaryId} onValueChange={setBeneficiaryId} placeholder="Selecione a pessoa" triggerClassName="min-h-11" options={people.map((person) => ({ value: person.id, label: person.name }))} /></div> : null}
                    <FileDropzone label="Arquivo" description="PDF, JPG ou PNG até 10 MB" accept="application/pdf,image/jpeg,image/png" multiple={false} maxFiles={1} maxSize={10 * 1024 * 1024} onFilesChange={(files) => setUploadFile(files[0] ?? null)} />
                    <div className="space-y-1.5"><Label htmlFor="sale-v2-observation">Observação (opcional)</Label><Input id="sale-v2-observation" value={uploadObservation} onChange={(event) => setUploadObservation(event.target.value)} placeholder="Ex.: confirmação da operadora" /></div>
                    <Button type="button" variant="outline" className="min-h-11 w-full" disabled={previewMode || pending || !uploadFile} onClick={uploadDocument}>{pending ? "Enviando…" : "Enviar para aprovação"}</Button>
                  </div>
                  {documents.length ? <div className="space-y-2"><p className="text-sm font-medium">Arquivos enviados</p>{documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="min-w-0 break-all">{document.filename}</span><Badge variant={document.status === "approved" ? "secondary" : "outline"}>{documentStatusLabel(document.status)}</Badge></div>)}</div> : null}
                </CardContent>
              </Card>
            ) : null}

            {stepIndex === 3 ? (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2"><CardTitle className="text-base">Revise antes de confirmar</CardTitle><CardDescription>A venda só será registrada quando os dados e documentos obrigatórios estiverem aprovados.</CardDescription></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Titular</p><p className="mt-1 font-medium">{holder?.name ?? lead.nome}</p><p className="text-xs text-muted-foreground">{holder?.age != null ? `${holder.age} anos` : holder?.birthDate ? dateLabel(holder.birthDate) : "Idade não informada"}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Pessoas no plano</p><p className="mt-1 font-medium">{people.length ? personCountLabel(people.length) : "Titular pendente"}</p><p className="text-xs text-muted-foreground">{people.filter((person) => !person.isHolder).map((person) => person.name).join(", ") || "Sem dependentes cadastrados"}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Plano e operadora</p><p className="mt-1 font-medium">{lead.planName || "Plano do lead"}</p><p className="text-xs text-muted-foreground">{carriers.find((carrier) => carrier.id === carrierId)?.name || "Operadora não alterada"}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Mensalidade</p><p className="mt-1 font-medium">{currencyLabel(approvedValue)}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Apólice ou contrato</p><p className="mt-1 font-medium">{policyNumber || "A informar"}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Vigência</p><p className="mt-1 font-medium">{dateLabel(coverageStartDate)} a {dateLabel(computedExpirationDate)}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Pagamento</p><p className="mt-1 font-medium">{paymentOptions.find((option) => option.value === paymentMethod)?.label}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Confirmação</p><p className="mt-1 font-medium">{approvedConfirmationDocuments.find((document) => document.id === confirmationDocumentId)?.filename || "Pendente de aprovação"}</p></div>
                  </div>
                  {!canConfirm ? <p role="status" className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{!holder ? "Complete os dados do titular." : approvedConfirmationDocuments.length === 0 ? "Falta anexar e aprovar a confirmação da operadora." : !confirmationDocumentId ? "Selecione a confirmação da operadora já aprovada." : missingDocuments.length ? requirementCountMessage(missingDocuments.length) : "Preencha o número do contrato, a vigência e o valor aprovado."}</p> : null}
                </CardContent>
              </Card>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" className="min-h-11" disabled={pending || stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>Voltar</Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => handleOpenChange(false)}>Fechar</Button>
                {stepIndex < STEPS.length - 1 ? <Button type="button" className="min-h-11" onClick={goNext}>Continuar</Button> : <Button type="button" className="min-h-11" disabled={previewMode || pending || !canConfirm} onClick={confirmSale}>{pending ? "Registrando…" : "Confirmar registro da venda"}</Button>}
              </div>
            </footer>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
      {successOverlay}
    </>
  );
}
