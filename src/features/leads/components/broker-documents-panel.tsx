"use client";

import { CheckCircle, FileText, Warning } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";

type Document = {
  id: string;
  filename: string;
  status: string;
  requirementType?: string;
};

type Requirement = {
  id: string;
  type: string;
  label: string;
  required: boolean;
};

type BrokerDocumentsPanelProps = {
  documents: Document[];
  requirements: Requirement[];
};

const REQUIREMENT_LABELS: Record<string, string> = {
  rg: "RG",
  cpf: "CPF",
  comprovante_residencia: "Comprovante de Residência",
  carteira_trabalho: "Carteira de Trabalho",
  certidao_nascimento: "Certidão de Nascimento",
  certidao_casamento: "Certidão de Casamento",
  outros: "Outros",
};

export function BrokerDocumentsPanel({ documents, requirements }: BrokerDocumentsPanelProps) {
  const documentsByType = documents.reduce(
    (acc, doc) => {
      const type = doc.requirementType ?? "outros";
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    },
    {} as Record<string, Document[]>,
  );

  const pendingCount = requirements.filter((req) => {
    const docs = documentsByType[req.type] ?? [];
    return req.required && docs.every((d) => d.status !== "approved");
  }).length;

  const rejectedCount = documents.filter((d) => d.status === "rejected").length;

  if (requirements.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
        <FileText className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhum documento obrigatório configurado para este lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            <Warning className="mr-1 size-3" /> {pendingCount} pendente(s)
          </Badge>
        )}
        {rejectedCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {rejectedCount} rejeitado(s)
          </Badge>
        )}
        {pendingCount === 0 && rejectedCount === 0 && (
          <Badge variant="default" className="text-[10px]">
            <CheckCircle className="mr-1 size-3" /> Todos os documentos OK
          </Badge>
        )}
      </div>

      {/* Requirements list */}
      <div className="space-y-1.5">
        {requirements.map((req) => {
          const docs = documentsByType[req.type] ?? [];
          const approved = docs.some((d) => d.status === "approved");
          const hasRejected = docs.some((d) => d.status === "rejected");
          const hasPending = docs.some((d) => d.status === "pending" || d.status === "uploaded");

          return (
            <div
              key={req.id}
              className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${approved ? "bg-green-500" : hasRejected ? "bg-red-500" : hasPending ? "bg-yellow-500" : "bg-muted-foreground/30"}`} />
                <span className="text-xs font-medium">{REQUIREMENT_LABELS[req.type] ?? req.type}</span>
                {req.required && <span className="text-[10px] text-destructive">*</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {approved && <CheckCircle className="size-3 text-green-500" />}
                {hasRejected && <Warning className="size-3 text-red-500" />}
                {hasPending && !approved && !hasRejected && (
                  <Badge variant="outline" className="text-[10px] py-0">Aguardando</Badge>
                )}
                {!approved && !hasPending && !hasRejected && (
                  <Badge variant="outline" className="text-[10px] py-0">Não enviado</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
