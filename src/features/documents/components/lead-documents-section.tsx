"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Eye,
  FolderSimple,
  Trash,
} from "@/components/huge-icons";
import { UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/status-badges";
import { confirmDocumentUploadAction, deleteDocumentAction } from "@/features/documents/actions";
import { FileUpload, type FileUploadItem } from "@/components/motion/file-upload";
import { AttachmentUpload, type AttachmentUploadItem } from "@/components/motion/attachment-upload";

type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  appliesPerBeneficiary?: boolean;
};

type UserDoc = {
  id: string;
  filename: string;
  fileUrl: string;
  status: string;
  requirementId: string | null;
  beneficiaryId: string | null;
  category?: string;
  description?: string | null;
  version?: number;
};

type ChecklistItem = {
  id: string;
  requirementId: string;
  requirementName: string;
  required: boolean;
  appliesPerBeneficiary: boolean;
  beneficiaryId: string | null;
  beneficiaryName: string | null;
  documentId: string | null;
  status: string;
};

type Beneficiary = { id: string; name: string; isHolder: boolean };

const documentFolderOrder = ["Identificação", "Dependentes", "Proposta e contratação", "Pós-venda", "Outros"] as const;

function getDocumentFolder(name: string, appliesPerBeneficiary: boolean) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (appliesPerBeneficiary || normalized.includes("depend") || normalized.includes("benefici")) return "Dependentes";
  if (normalized.includes("contrat") || normalized.includes("propost") || normalized.includes("apolice") || normalized.includes("plano")) return "Proposta e contratação";
  if (normalized.includes("renova") || normalized.includes("cancel") || normalized.includes("vigenc")) return "Pós-venda";
  if (normalized.includes("cpf") || normalized.includes("rg") || normalized.includes("identidade") || normalized.includes("documento pessoal")) return "Identificação";
  return "Outros";
}

export function LeadDocumentsSection({
  leadId,
  clientId,
  requirements,
  documents: initialDocs,
  checklist,
  beneficiaries,
}: {
  leadId: string;
  clientId?: string | null;
  requirements: Requirement[];
  documents: UserDoc[];
  checklist?: ChecklistItem[];
  beneficiaries?: Beneficiary[];
}) {
  const router = useRouter();
  const [documents] = useState<UserDoc[]>(initialDocs);
  const [selectedBeneficiaryByRequirement, setSelectedBeneficiaryByRequirement] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [category, setCategory] = useState("outros");
  const [description, setDescription] = useState("");
  const [selectedAvulsoBeneficiaryId, setSelectedAvulsoBeneficiaryId] = useState<string>(beneficiaries?.[0]?.id ?? "");
  const [avulsoQueue, setAvulsoQueue] = useState<FileUploadItem[]>([]);
  const [, startTransition] = useTransition();

  const handleFileUploadSingle = async (file: File, reqId: string | null, beneficiaryId: string | null = null) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 10MB por arquivo.");
      return;
    }

    setUploadingId(reqId || "avulso");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("leadId", leadId);

    try {
      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error || "Erro no upload.");
      }

      const data = await uploadRes.json();

      startTransition(async () => {
        const res = await confirmDocumentUploadAction({
          leadId,
          requirementId: reqId,
          beneficiaryId,
          filename: data.filename,
          fileUrl: data.fileUrl,
          storageKey: data.storageKey,
          category,
          description,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          checksumSha256: data.checksumSha256,
          clientId,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`Documento "${file.name}" enviado com sucesso!`);
          setDescription("");
          router.refresh();
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no envio.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, reqId: string | null, beneficiaryId: string | null = null) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUploadSingle(file, reqId, beneficiaryId);
    }
  };

  const handleBatchAvulsoAdd = async (items: FileUploadItem[], files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        await handleFileUploadSingle(file, null, selectedAvulsoBeneficiaryId || null);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    return <DocumentStatusBadge status={status} />;
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm("Remover este documento do atendimento? O arquivo ficará indisponível para consulta.")) return;
    const result = await deleteDocumentAction(documentId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Documento removido.");
      router.refresh();
    }
  };

  const groupedRequirements = documentFolderOrder
    .map((folder) => [folder, requirements.filter((requirement) => getDocumentFolder(requirement.name, Boolean(requirement.appliesPerBeneficiary)) === folder)] as const)
    .filter(([, folderRequirements]) => folderRequirements.length > 0);

  const isRequirementApproved = (requirement: Requirement) => {
    const persisted = checklist?.filter((item) => item.requirementId === requirement.id) ?? [];
    if (persisted.length > 0) {
      if (!requirement.appliesPerBeneficiary) return persisted.some((item) => item.status === "approved");
      return (beneficiaries ?? []).length > 0 && (beneficiaries ?? []).every((beneficiary) =>
        persisted.some((item) => item.beneficiaryId === beneficiary.id && item.status === "approved"),
      );
    }

    const approvedDocuments = documents.filter(
      (document) => document.requirementId === requirement.id && document.status === "approved",
    );
    const requirementBeneficiaries = beneficiaries ?? [];

    if (!requirement.appliesPerBeneficiary) return approvedDocuments.length > 0;

    return requirementBeneficiaries.length > 0 && requirementBeneficiaries.every((beneficiary) =>
      approvedDocuments.some((document) => document.beneficiaryId === beneficiary.id),
    );
  };

  const requiredRequirements = requirements.filter((requirement) => requirement.required);
  const completedRequired = requiredRequirements.filter(isRequirementApproved).length;
  const pendingRequired = requiredRequirements.filter((requirement) => !isRequirementApproved(requirement));
  const nextRequirement = pendingRequired[0] ?? null;
  const progress = requiredRequirements.length ? Math.round((completedRequired / requiredRequirements.length) * 100) : 100;
  const pendingReview = documents.filter((document) => document.status === "pending").length;
  const rejected = documents.filter((document) => document.status === "rejected").length;
  const beneficiaryName = (beneficiaryId: string | null) => beneficiaries?.find((beneficiary) => beneficiary.id === beneficiaryId)?.name ?? "Atendimento";

  return (
    <div className="space-y-4">
      {/* Resumo do Checklist */}
      <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Checklist documental do atendimento</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {requiredRequirements.length
                ? `${completedRequired} de ${requiredRequirements.length} obrigatórios aprovados`
                : "Nenhum documento obrigatório foi configurado para este atendimento."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={pendingRequired.length ? "secondary" : "default"}>
              {pendingRequired.length ? `${pendingRequired.length} pendente${pendingRequired.length > 1 ? "s" : ""}` : "Checklist concluído"}
            </Badge>
            {pendingReview ? <Badge variant="outline">{pendingReview} em revisão</Badge> : null}
            {rejected ? <Badge variant="destructive">{rejected} recusado{rejected > 1 ? "s" : ""}</Badge> : null}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div
            aria-label={`${progress}% dos documentos obrigatórios aprovados`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {nextRequirement ? (
          <div className="border-t border-border/60 bg-card/70 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Próxima ação recomendada</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                Enviar {nextRequirement.name}{nextRequirement.appliesPerBeneficiary ? " para cada beneficiário" : ""}
              </p>
              <span className="text-xs font-semibold text-primary">Obrigatório para avançar</span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Pastas e Requisitos */}
      <div className="space-y-3">
        {groupedRequirements.map(([folder, folderRequirements]) => (
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs" key={folder}>
            <header className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FolderSimple className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{folder}</h4>
                  <p className="text-[11px] text-muted-foreground">{folderRequirements.length} requisito{folderRequirements.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {folderRequirements.filter(isRequirementApproved).length}/{folderRequirements.length} concluídos
              </Badge>
            </header>
            <div className="space-y-3 p-3">
              {folderRequirements.map((req) => {
                const relevantDocuments = documents.filter((d) => d.requirementId === req.id);
                const selectedBeneficiaryId = selectedBeneficiaryByRequirement[req.id] ?? beneficiaries?.[0]?.id ?? null;
                const persisted = checklist?.filter((item) => item.requirementId === req.id) ?? [];
                const selectedChecklist = persisted.find((item) => (req.appliesPerBeneficiary ? item.beneficiaryId === selectedBeneficiaryId : true));
                const doc = selectedChecklist?.documentId
                  ? relevantDocuments.find((item) => item.id === selectedChecklist.documentId)
                  : relevantDocuments.find((d) => (req.appliesPerBeneficiary ? d.beneficiaryId === selectedBeneficiaryId : true));
                const needsBeneficiary = Boolean(req.appliesPerBeneficiary && !beneficiaries?.length);

                const attachmentItems: AttachmentUploadItem[] = doc
                  ? [
                      {
                        id: doc.id,
                        name: doc.filename,
                        kind: doc.filename.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? "image" : "file",
                        href: doc.fileUrl,
                        previewUrl: doc.filename.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? doc.fileUrl : undefined,
                        status: doc.status === "approved" ? "complete" : doc.status === "rejected" ? "failed" : "idle",
                        error: doc.status === "rejected" ? "Documento recusado" : undefined,
                      },
                    ]
                  : [];

                return (
                  <div
                    key={req.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-xs shadow-2xs"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <FileText className="size-4 text-primary shrink-0" />
                          <span>{req.name}</span>
                          {req.required && <span className="text-[10px] text-destructive font-bold uppercase tracking-wider">Obrigatório</span>}
                        </div>
                        {req.description && <p className="text-muted-foreground">{req.description}</p>}
                        {req.appliesPerBeneficiary && beneficiaries?.length ? (
                          <div className="pt-1">
                            <AppSelect
                              aria-label={`Beneficiário do requisito ${req.name}`}
                              size="sm"
                              className="w-48"
                              value={selectedBeneficiaryId ?? ""}
                              onValueChange={(val) =>
                                setSelectedBeneficiaryByRequirement((current) => ({ ...current, [req.id]: val }))
                              }
                              options={beneficiaries.map((b) => ({
                                value: b.id,
                                label: `${b.name}${b.isHolder ? " (Titular)" : ""}`,
                              }))}
                            />
                          </div>
                        ) : null}
                        {req.appliesPerBeneficiary && beneficiaries?.length && persisted.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`Andamento de ${req.name} por beneficiário`}>
                            {beneficiaries.map((beneficiary) => {
                              const item = persisted.find((entry) => entry.beneficiaryId === beneficiary.id);
                              const label = item?.status === "approved" ? "Aprovado" : item?.status === "rejected" ? "Recusado" : "Pendente";
                              return (
                                <Badge
                                  key={beneficiary.id}
                                  variant={item?.status === "approved" ? "default" : item?.status === "rejected" ? "destructive" : "outline"}
                                  className="text-[10px]"
                                >
                                  {beneficiary.name}: {label}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : null}
                        {needsBeneficiary ? <p className="text-xs text-muted-foreground">Cadastre o titular ou beneficiário antes de enviar este documento.</p> : null}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {needsBeneficiary ? (
                          <Badge variant="outline">Aguardando beneficiário</Badge>
                        ) : doc ? (
                          <div className="flex items-center gap-2">
                            {getStatusBadge(doc.status)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {!needsBeneficiary ? (
                      <AttachmentUpload
                        value={attachmentItems}
                        maxFiles={1}
                        maxFileSize={10 * 1024 * 1024}
                        accept=".pdf,.jpg,.jpeg,.png"
                        title={doc ? "Arraste um novo arquivo para substituir" : `Arraste ou escolha o arquivo de ${req.name}`}
                        description="PDF, JPG ou PNG de até 10MB"
                        attachmentsLabel="Documento anexado:"
                        disabled={uploadingId === req.id}
                        onFilesAdded={([added]) => {
                          if (added?.file) {
                            void handleFileUploadSingle(added.file, req.id, req.appliesPerBeneficiary ? selectedBeneficiaryId : null);
                          }
                        }}
                        onRemove={() => {
                          if (doc) void handleDelete(doc.id);
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Ingestão de Documentos Adicionais (Avulsos) via FileUpload Queue */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">Envio Rápido & Documentos Adicionais (Avulsos)</h4>
            <p className="text-xs text-muted-foreground">Arraste múltiplos arquivos para carregar comprovantes ou documentos avulsos em lote.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              Pessoa
              <AppSelect
                aria-label="Pessoa do documento adicional"
                size="sm"
                className="w-48"
                value={selectedAvulsoBeneficiaryId}
                onValueChange={setSelectedAvulsoBeneficiaryId}
                disabled={!beneficiaries?.length}
                options={
                  beneficiaries?.length
                    ? beneficiaries.map((b) => ({
                        value: b.id,
                        label: `${b.name}${b.isHolder ? " (Titular)" : " (Dependente)"}`,
                      }))
                    : [{ value: "", label: "Cadastre o titular primeiro" }]
                }
              />
            </label>

            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              Categoria
              <AppSelect
                aria-label="Categoria do documento"
                size="sm"
                className="w-36"
                value={category}
                onValueChange={setCategory}
                options={[
                  { value: "outros", label: "Outros" },
                  { value: "identificacao", label: "Identificação" },
                  { value: "proposta", label: "Proposta" },
                  { value: "contratacao", label: "Contratação" },
                  { value: "pos_venda", label: "Pós-venda" },
                ]}
              />
            </label>
          </div>
        </div>

        <input
          aria-label="Observação do documento"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Observação opcional (ex.: documento complementar enviado pelo cliente por WhatsApp)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <FileUpload
          value={avulsoQueue}
          onValueChange={setAvulsoQueue}
          variant="centered"
          disabled={!beneficiaries?.length}
          title={beneficiaries?.length ? "Solte arquivos avulsos aqui para enviar" : "Cadastre o titular antes de enviar documentos"}
          description="PDF, imagens, documentos compactados de até 10MB"
          browseLabel="Escolher arquivos"
          onFilesAdded={handleBatchAvulsoAdd}
        />

        {documents.filter((d) => !d.requirementId).length > 0 ? (
          <div className="mt-4 space-y-2">
            <h5 className="text-xs font-semibold text-foreground">Documentos Avulsos Já Enviados</h5>
            <div className="grid gap-2">
              {documents
                .filter((d) => !d.requirementId)
                .map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 bg-background text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UploadCloud className="size-4 text-primary shrink-0" />
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-primary hover:underline"
                      >
                        {doc.filename}
                      </a>
                      {doc.description ? <span className="truncate text-[11px] text-muted-foreground">({doc.description})</span> : null}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">{beneficiaryName(doc.beneficiaryId)}</span>
                      {getStatusBadge(doc.status)}
                      <button
                        type="button"
                        aria-label={`Remover ${doc.filename}`}
                        className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        onClick={() => void handleDelete(doc.id)}
                      >
                        <Trash className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
