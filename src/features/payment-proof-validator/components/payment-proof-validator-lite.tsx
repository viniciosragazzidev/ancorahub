"use client";

/**
 * Validador de comprovante no visual Lite (Onda 8): os mesmos três documentos, a mesma leitura (mesma rota da API),
 * as mesmas regras e o mesmo veredito. Arquivos em linhas de 44px, resultado com status em texto e ícone.
 */
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, MinusCircle, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";
import { validatePaymentProof } from "../rules";
import type { BoletoExtraction, CheckStatus, DocumentKind, ProofExtraction, ProposalExtraction, ValidationResult } from "../types";
import { readDocument, SLOTS, VERDICT, type Slot } from "./payment-proof-validator";
import styles from "./payment-proof-validator-lite.module.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS: Record<CheckStatus, { icon: typeof CheckCircle2; tone: string; label: string }> = {
  ok: { icon: CheckCircle2, tone: "success", label: "Confere" },
  warn: { icon: TriangleAlert, tone: "warning", label: "Atenção" },
  fail: { icon: XCircle, tone: "danger", label: "Divergente" },
  skip: { icon: MinusCircle, tone: "muted", label: "Não verificado" },
};

const VERDICT_TONE = { success: "success", warning: "warning", destructive: "danger" } as const;

export type ValidatorLiteResult = { validation: ValidationResult; proposal: ProposalExtraction; proof: ProofExtraction; boleto: BoletoExtraction | null };

function FileRow({ slot, file, disabled, onChange }: { slot: Slot; file: File | null; disabled: boolean; onChange: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <li className={styles.fileRow}>
      <span className={styles.fileText}>
        <span className={page.cellTitle}>{slot.label}{slot.required ? null : <span className={page.muted}> (opcional)</span>}</span>
        <span className={`${page.cellSub} ${styles.truncate}`}>{file ? file.name : slot.hint}</span>
      </span>
      <span className={styles.fileActions}>
        {file ? <button type="button" className={styles.ghostButton} disabled={disabled} onClick={() => onChange(null)}>Remover</button> : null}
        <button type="button" className={page.button} disabled={disabled} onClick={() => inputRef.current?.click()}>
          <FileUp aria-hidden="true" size={16} /> {file ? "Trocar" : "Escolher arquivo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={slot.accept}
          aria-label={slot.label}
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </span>
    </li>
  );
}

function ReadData({ proposal, proof, boleto }: { proposal: ProposalExtraction; proof: ProofExtraction; boleto: BoletoExtraction | null }) {
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
    <details className={styles.readData}>
      <summary>Ver dados lidos dos documentos</summary>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "não encontrado"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function PaymentProofValidatorLite({ initialResult = null }: { initialResult?: ValidatorLiteResult | null }) {
  const [files, setFiles] = useState<Record<DocumentKind, File | null>>({ proposta: null, comprovante: null, boleto: null });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidatorLiteResult | null>(initialResult);

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
      setResult({ validation: validatePaymentProof({ proposal: proposalDoc.data, proof: proofDoc.data, boleto }), proposal: proposalDoc.data, proof: proofDoc.data, boleto });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível validar.");
    } finally {
      setRunning(false);
    }
  }

  const verdict = result ? VERDICT[result.validation.verdict] : null;

  return (
    <div className={styles.column}>
      <section className={page.card} aria-labelledby="proof-docs-title">
        <div className={styles.headRow}>
          <div className={page.cardHead}>
            <h2 id="proof-docs-title" className={page.cardTitle}>Documentos do pedido</h2>
            <p className={page.cardDescription}>Envie a proposta e o comprovante que o corretor mandou. Os arquivos são lidos na hora e não ficam salvos.</p>
          </div>
          <button type="button" className={page.primaryButton} disabled={!ready} onClick={() => void handleValidate()}>
            <ShieldCheck aria-hidden="true" size={16} /> {running ? "Validando..." : "Validar comprovante"}
          </button>
        </div>
        <ul className={styles.files}>
          {SLOTS.map((slot) => (
            <FileRow
              key={slot.kind}
              slot={slot}
              file={files[slot.kind]}
              disabled={running}
              onChange={(file) => {
                setFiles((current) => ({ ...current, [slot.kind]: file }));
                setResult(null);
              }}
            />
          ))}
        </ul>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>

      {result && verdict ? (
        <section className={page.card} aria-live="polite" aria-labelledby="proof-result-title">
          <div className={styles.headRow}>
            <div className={page.cardHead}>
              <h2 id="proof-result-title" className={page.cardTitle}>Resultado</h2>
              <p className={page.cardDescription}>{verdict.text}</p>
            </div>
            <span className={page.badge} data-tone={VERDICT_TONE[verdict.variant]}>{verdict.label}</span>
          </div>
          <ul className={styles.checks}>
            {result.validation.checks.map((check) => {
              const status = STATUS[check.status];
              const Icon = status.icon;
              return (
                <li key={check.id} className={styles.check}>
                  <Icon aria-label={status.label} size={18} className={styles.checkIcon} data-tone={status.tone} />
                  <span className={styles.fileText}>
                    <span className={page.cellTitle}>{check.label}</span>
                    <span className={page.cellSub}>{check.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={page.cellSub}>O validador não substitui a operadora: antes de pagar o adiantamento, confirme a baixa do boleto no portal dela.</p>
          <ReadData boleto={result.boleto} proof={result.proof} proposal={result.proposal} />
        </section>
      ) : null}
    </div>
  );
}
