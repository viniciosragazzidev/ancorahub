"use client";

import { useRef, useState } from "react";
import {
  CheckCircle,
  FileArrowUp,
  MinusCircle,
  Receipt,
  ShieldCheck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { cn } from "@/lib/utils";

import { validatePaymentProof } from "../rules";
import type {
  BoletoExtraction,
  CheckStatus,
  DocumentKind,
  ExtractedDocument,
  ProofExtraction,
  ProposalExtraction,
  ValidationResult,
  ValidationVerdict,
} from "../types";

type Slot = {
  kind: DocumentKind;
  label: string;
  hint: string;
  accept: string;
  required: boolean;
};

const SLOTS: Slot[] = [
  { kind: "proposta", label: "Proposta", hint: "PDF gerado pela operadora", accept: "application/pdf", required: true },
  {
    kind: "comprovante",
    label: "Comprovante de pagamento",
    hint: "PDF do banco (melhor) ou print",
    accept: "application/pdf,image/png,image/jpeg,image/webp",
    required: true,
  },
  {
    kind: "boleto",
    label: "Boleto original",
    hint: "Opcional. PDF emitido pela operadora, deixa a checagem mais forte",
    accept: "application/pdf",
    required: false,
  },
];

const VERDICT: Record<ValidationVerdict, { label: string; variant: "success" | "warning" | "destructive"; text: string }> = {
  aprovavel: {
    label: "Aprovável",
    variant: "success",
    text: "Tudo confere. Confirme a baixa no portal da operadora e libere o adiantamento.",
  },
  revisar: {
    label: "Revisar",
    variant: "warning",
    text: "Há pontos sem confirmação. Resolva os alertas antes de liberar o adiantamento.",
  },
  recusar: {
    label: "Recusar",
    variant: "destructive",
    text: "Há divergência grave. Não libere o adiantamento com este comprovante.",
  },
};

const STATUS_ICON: Record<CheckStatus, { icon: typeof CheckCircle; className: string; label: string }> = {
  ok: { icon: CheckCircle, className: "text-success", label: "Confere" },
  warn: { icon: WarningCircle, className: "text-warning", label: "Atenção" },
  fail: { icon: XCircle, className: "text-destructive", label: "Divergente" },
  skip: { icon: MinusCircle, className: "text-muted-foreground", label: "Não verificado" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function readDocument(kind: DocumentKind, file: File): Promise<ExtractedDocument> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  const response = await fetch("/api/ferramentas/validador-comprovante", { method: "POST", body });
  const payload = (await response.json().catch(() => null)) as { document?: ExtractedDocument; error?: string } | null;
  if (!response.ok || !payload?.document) {
    throw new Error(payload?.error ?? "Não foi possível ler o documento.");
  }
  return payload.document;
}

function FileSlot({
  slot,
  file,
  disabled,
  onChange,
}: {
  slot: Slot;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {slot.label}
          {slot.required ? null : <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{file ? file.name : slot.hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {file ? (
          <Button disabled={disabled} onClick={() => onChange(null)} size="sm" type="button" variant="ghost">
            Remover
          </Button>
        ) : null}
        <Button disabled={disabled} onClick={() => inputRef.current?.click()} size="sm" type="button" variant="outline">
          <FileArrowUp aria-hidden="true" />
          {file ? "Trocar" : "Escolher arquivo"}
        </Button>
        <input
          accept={slot.accept}
          aria-label={slot.label}
          className="hidden"
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
    </div>
  );
}

function ReadData({
  proposal,
  proof,
  boleto,
}: {
  proposal: ProposalExtraction;
  proof: ProofExtraction;
  boleto: BoletoExtraction | null;
}) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Operadora", proposal.operadora],
    ["Proposta", proposal.numeroProposta],
    ["Total da proposta", proposal.valorTotal != null ? brl.format(proposal.valorTotal) : null],
    ["Titular", proposal.titular.nome],
    ["Empresa", proposal.empresa?.razaoSocial],
    ["E-mail da proposta", proposal.emailContato],
    ["Corretor", proposal.corretor?.nome],
    ["Comprovante", [proof.instituicao, proof.status].filter(Boolean).join(" · ")],
    ["Valor pago", proof.valor != null ? brl.format(proof.valor) : null],
    ["Beneficiário", [proof.beneficiarioNome, proof.beneficiarioDocumento].filter(Boolean).join(" · ")],
    ["Pagador", [proof.pagadorNome, proof.pagadorDocumento].filter(Boolean).join(" · ")],
    ["Linha digitável", proof.linhaDigitavel],
    ["Boleto original", boleto ? [boleto.beneficiarioNome, boleto.linhaDigitavel].filter(Boolean).join(" · ") : null],
  ];
  return (
    <details className="group border-t border-border/50 px-4 py-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ver dados lidos dos documentos</summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div className="flex min-w-0 gap-2" key={label}>
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-all">{value || "não encontrado"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function PaymentProofValidator() {
  const [files, setFiles] = useState<Record<DocumentKind, File | null>>({ proposta: null, comprovante: null, boleto: null });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    validation: ValidationResult;
    proposal: ProposalExtraction;
    proof: ProofExtraction;
    boleto: BoletoExtraction | null;
  } | null>(null);

  const ready = Boolean(files.proposta && files.comprovante) && !running;

  async function handleValidate() {
    if (!files.proposta || !files.comprovante) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const [proposalDoc, proofDoc, boletoDoc] = await Promise.all([
        readDocument("proposta", files.proposta),
        readDocument("comprovante", files.comprovante),
        files.boleto ? readDocument("boleto", files.boleto) : Promise.resolve(null),
      ]);
      if (proposalDoc.kind !== "proposta" || proofDoc.kind !== "comprovante") {
        throw new Error("Resposta inesperada ao ler os documentos.");
      }
      const boleto = boletoDoc?.kind === "boleto" ? boletoDoc.data : null;
      setResult({
        validation: validatePaymentProof({ proposal: proposalDoc.data, proof: proofDoc.data, boleto }),
        proposal: proposalDoc.data,
        proof: proofDoc.data,
        boleto,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar.");
    } finally {
      setRunning(false);
    }
  }

  const verdict = result ? VERDICT[result.validation.verdict] : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Card variant="overview">
        <SectionCardHeader
          icon={<Receipt />}
          title="Documentos do pedido"
          description="Envie a proposta e o comprovante que o corretor mandou. Os arquivos são lidos na hora e não ficam salvos."
          actions={
            <Button disabled={!ready} onClick={handleValidate} type="button" variant="deep-sapphire">
              <ShieldCheck aria-hidden="true" />
              {running ? "Validando..." : "Validar comprovante"}
            </Button>
          }
        />
        <CardContent className="flex flex-col gap-3 p-4">
          {SLOTS.map((slot) => (
            <FileSlot
              disabled={running}
              file={files[slot.kind]}
              key={slot.kind}
              onChange={(file) => {
                setFiles((current) => ({ ...current, [slot.kind]: file }));
                setResult(null);
              }}
              slot={slot}
            />
          ))}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result && verdict ? (
        <Card variant="overview" aria-live="polite">
          <SectionCardHeader
            icon={<ShieldCheck />}
            title="Resultado"
            badge={<Badge variant={verdict.variant}>{verdict.label}</Badge>}
            description={verdict.text}
          />
          <ul className="divide-y divide-border/50">
            {result.validation.checks.map((check) => {
              const status = STATUS_ICON[check.status];
              const Icon = status.icon;
              return (
                <li className="flex items-start gap-3 px-4 py-3" key={check.id}>
                  <Icon aria-label={status.label} className={cn("mt-0.5 size-4 shrink-0", status.className)} weight="fill" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{check.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            O validador não substitui a operadora: antes de pagar o adiantamento, confirme a baixa do boleto no portal dela.
          </p>
          <ReadData boleto={result.boleto} proof={result.proof} proposal={result.proposal} />
        </Card>
      ) : null}
    </div>
  );
}
