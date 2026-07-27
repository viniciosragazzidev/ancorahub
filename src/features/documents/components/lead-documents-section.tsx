"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  FileText,
  Eye,
  Plus,
  FolderSimple,
  Trash,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge } from "@/components/status-badges";
import { confirmDocumentUploadAction, deleteDocumentAction } from "@/features/documents/actions";

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
  const [documents] = useState<UserDoc[]>(initialDocs);
  const [selectedBeneficiaryByRequirement, setSelectedBeneficiaryByRequirement] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [category, setCategory] = useState("outros");
  const [description, setDescription] = useState("");
  const [selectedAvulsoBeneficiaryId, setSelectedAvulsoBeneficiaryId] = useState<string>(beneficiaries?.[0]?.id ?? "");
  const [, startTransition] = useTransition();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, reqId: string | null, beneficiaryId: string | null = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 10MB.");
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
        const errorData = await uploadRes.json().catch(() => null) as { error?: string } | null;
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
          toast.success("Documento enviado com sucesso!");
          setDescription("");
          // Reload page/state
          window.location.reload();
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no envio.");
    } finally {
      setUploadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    return <DocumentStatusBadge status={status} />;
  };

  const handleDelete = async (documentId: string) => {
    if (!window.confirm("Remover este documento do atendimento? O arquivo ficará indisponível para consulta.")) return;
    const result = await deleteDocumentAction(documentId);
    if (result.error) toast.error(result.error);
    else { toast.success("Documento removido."); window.location.reload(); }
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
      <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-sm font-semibold">Checklist documental</p><p className="mt-1 text-xs text-muted-foreground">{requiredRequirements.length ? `${completedRequired} de ${requiredRequirements.length} obrigatórios aprovados` : "Nenhum documento obrigatório foi configurado para este atendimento."}</p></div>
          <div className="flex items-center gap-2"><Badge variant={pendingRequired.length ? "secondary" : "default"}>{pendingRequired.length ? `${pendingRequired.length} pendente${pendingRequired.length > 1 ? "s" : ""}` : "Checklist concluído"}</Badge>{pendingReview ? <Badge variant="outline">{pendingReview} em revisão</Badge> : null}{rejected ? <Badge variant="destructive">{rejected} recusado{rejected > 1 ? "s" : ""}</Badge> : null}</div>
        </div>
        <div className="px-4 pb-4"><div aria-label={`${progress}% dos documentos obrigatórios aprovados`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div></div>
        {nextRequirement ? <div className="border-t border-border/60 bg-card/70 px-4 py-3"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Próxima ação</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Enviar {nextRequirement.name}{nextRequirement.appliesPerBeneficiary ? " para cada beneficiário" : ""}</p><span className="text-xs text-muted-foreground">Obrigatório para avançar</span></div></div> : null}
      </section>
      <div className="space-y-2">
        {groupedRequirements.map(([folder, folderRequirements]) => (
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card" key={folder}>
            <header className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><FolderSimple className="size-4" /></span>
                <div><h4 className="text-sm font-semibold">{folder}</h4><p className="text-[11px] text-muted-foreground">{folderRequirements.length} requisito{folderRequirements.length !== 1 ? "s" : ""}</p></div>
              </div>
              <Badge variant="outline" className="text-[10px]">{folderRequirements.filter(isRequirementApproved).length}/{folderRequirements.length} concluídos</Badge>
            </header>
            <div className="space-y-2 p-3">
        {folderRequirements.map((req) => {
          const relevantDocuments = documents.filter((d) => d.requirementId === req.id);
          const selectedBeneficiaryId = selectedBeneficiaryByRequirement[req.id] ?? beneficiaries?.[0]?.id ?? null;
          const persisted = checklist?.filter((item) => item.requirementId === req.id) ?? [];
          const selectedChecklist = persisted.find((item) => (req.appliesPerBeneficiary ? item.beneficiaryId === selectedBeneficiaryId : true));
          const doc = selectedChecklist?.documentId
            ? relevantDocuments.find((item) => item.id === selectedChecklist.documentId)
            : relevantDocuments.find((d) => (req.appliesPerBeneficiary ? d.beneficiaryId === selectedBeneficiaryId : true));
          const needsBeneficiary = Boolean(req.appliesPerBeneficiary && !beneficiaries?.length);

          return (
            <div
              key={req.id}
              className="flex flex-col gap-3 rounded-lg border p-4 bg-card text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <FileText className="size-4 text-primary shrink-0" />
                  {req.name}
                  {req.required && <span className="text-[10px] text-destructive font-bold uppercase">Obrigatório</span>}
                </div>
                {req.description && <p className="text-muted-foreground">{req.description}</p>}
                {req.appliesPerBeneficiary && beneficiaries?.length ? <select aria-label={`Beneficiário do requisito ${req.name}`} className="mt-2 h-8 rounded-md border border-input bg-background px-2 text-xs" value={selectedBeneficiaryId ?? ""} onChange={(event) => setSelectedBeneficiaryByRequirement((current) => ({ ...current, [req.id]: event.target.value }))}>{beneficiaries.map((beneficiary) => <option key={beneficiary.id} value={beneficiary.id}>{beneficiary.name}{beneficiary.isHolder ? " (Titular)" : ""}</option>)}</select> : null}
                {req.appliesPerBeneficiary && beneficiaries?.length && persisted.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`Andamento de ${req.name} por beneficiário`}>
                    {beneficiaries.map((beneficiary) => {
                      const item = persisted.find((entry) => entry.beneficiaryId === beneficiary.id);
                      const label = item?.status === "approved" ? "Aprovado" : item?.status === "rejected" ? "Recusado" : "Pendente";
                      return <Badge key={beneficiary.id} variant={item?.status === "approved" ? "default" : item?.status === "rejected" ? "destructive" : "outline"} className="text-[10px]">{beneficiary.name}: {label}</Badge>;
                    })}
                  </div>
                ) : null}
                {needsBeneficiary ? <p className="text-xs text-muted-foreground">Cadastre o titular ou beneficiário antes de enviar este documento.</p> : null}
              </div>

              <div className="flex items-center gap-3">
                {needsBeneficiary ? (
                  <Badge variant="outline">Aguardando beneficiário</Badge>
                ) : doc ? (
                  <>
                    <div className="flex flex-col items-end gap-1">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {doc.filename.slice(-20)} <Eye className="size-3.5" />
                      </a>
                      {getStatusBadge(doc.status)}
                      <button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => void handleDelete(doc.id)}>
                        <Trash className="size-3" /> Remover
                      </button>
                    </div>

                    {(doc.status === "rejected" || doc.status === "pending") && (
                      <label className="relative inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border px-2.5 hover:bg-muted text-xs transition-colors">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.png,.jpeg"
                          className="sr-only"
                          disabled={uploadingId !== null}
                          onChange={(e) => handleUpload(e, req.id, req.appliesPerBeneficiary ? selectedBeneficiaryId : null)}
                        />
                        {uploadingId === req.id ? "Enviando..." : "Substituir"}
                      </label>
                    )}
                  </>
                ) : (
                  <label className="relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary px-3 font-semibold text-primary-foreground hover:bg-primary/80 text-xs transition-colors gap-1.5 shadow-sm">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png,.jpeg"
                      className="sr-only"
                      disabled={uploadingId !== null}
                      onChange={(e) => handleUpload(e, req.id, req.appliesPerBeneficiary ? selectedBeneficiaryId : null)}
                    />
                    <Plus className="size-3.5" />
                    {uploadingId === req.id ? "Enviando..." : "Enviar arquivo"}
                  </label>
                )}
              </div>
            </div>
          );
        })}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-heading text-xs font-semibold">Documentos Adicionais (Avulsos)</h4>
          <div className="flex flex-wrap items-center gap-2">
          <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">Pessoa
            <select aria-label="Pessoa do documento adicional" className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground" value={selectedAvulsoBeneficiaryId} onChange={(event) => setSelectedAvulsoBeneficiaryId(event.target.value)} disabled={!beneficiaries?.length}>
              {beneficiaries?.length ? beneficiaries.map((beneficiary) => <option key={beneficiary.id} value={beneficiary.id}>{beneficiary.name}{beneficiary.isHolder ? " (Titular)" : " (Dependente)"}</option>) : <option value="">Cadastre o titular primeiro</option>}
            </select>
          </label>
          <select aria-label="Categoria do documento" className="h-7 rounded-md border border-input bg-background px-2 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="outros">Outros</option><option value="identificacao">Identificação</option><option value="proposta">Proposta</option><option value="contratacao">Contratação</option><option value="pos_venda">Pós-venda</option>
          </select>
          <label className="relative inline-flex h-7 cursor-pointer items-center justify-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted transition-colors gap-1">
            <input
              type="file"
              accept=".pdf,.jpg,.png,.jpeg"
              className="sr-only"
              disabled={uploadingId !== null || !beneficiaries?.length}
              onChange={(e) => handleUpload(e, null, selectedAvulsoBeneficiaryId || null)}
            />
            <Plus className="size-3.5" />
            {uploadingId === "avulso" ? "Enviando..." : "Adicionar outro"}
          </label>
          </div>
        </div>
        <input aria-label="Observação do documento" className="mb-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs" placeholder="Observação opcional (ex.: documento recebido por WhatsApp)" value={description} onChange={(event) => setDescription(event.target.value)} />

        <div className="grid gap-2">
          {documents
            .filter((d) => !d.requirementId)
            .map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 bg-card text-xs"
              >
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {doc.filename} <Eye className="size-3" />
                </a>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">{beneficiaryName(doc.beneficiaryId)}</span>
                  {getStatusBadge(doc.status)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
