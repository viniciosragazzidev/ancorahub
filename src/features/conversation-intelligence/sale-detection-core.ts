/**
 * Venda detectada pela IA (10/11, pedido do Vinicios): quando a conversa prova que a venda aconteceu
 * (adesão paga, proposta transmitida, carteirinha ou nº da proposta emitido), o lead vai sozinho para
 * Convertido, o corretor é parabenizado e a direção é avisada. Regras puras, sem I/O.
 */
import { z } from "zod";

export const SALE_SIGNALS = [
  "payment",
  "proposal_transmitted",
  "contract_signed",
  "card_or_proposal_number",
  "medical_interview_approved",
] as const;
export type SaleSignal = (typeof SALE_SIGNALS)[number];

export const SALE_SIGNAL_LABELS: Record<SaleSignal, string> = {
  payment: "adesão paga",
  proposal_transmitted: "proposta transmitida",
  contract_signed: "contrato assinado",
  card_or_proposal_number: "carteirinha ou nº da proposta emitido",
  medical_interview_approved: "entrevista médica aprovada",
};

const NO_SALE = { status: "no" as const, signals: [] as SaleSignal[], evidence: [] as string[] };

/**
 * Sinal estruturado de venda concluída. Análises antigas não têm o campo e qualquer valor fora do formato
 * vira "no": nunca converte por erro de leitura.
 */
export const SaleCompletedSchema = z
  .object({
    status: z.enum(["confirmed", "likely", "no"]).catch("no"),
    signals: z
      .array(z.string())
      .catch([])
      .transform((items) => [...new Set(items.filter((item): item is SaleSignal => (SALE_SIGNALS as readonly string[]).includes(item)))]),
    evidence: z
      .array(z.string())
      .catch([])
      .transform((items) => items.map((item) => item.trim().slice(0, 300)).filter(Boolean).slice(0, 5)),
  })
  .catch(NO_SALE);
export type SaleCompleted = z.infer<typeof SaleCompletedSchema>;

export function readSaleCompleted(value: unknown): SaleCompleted {
  return value === undefined || value === null ? NO_SALE : SaleCompletedSchema.parse(value);
}

/** Etapas de fechamento: Documentação e Em análise. */
const CLOSING_STATUSES: ReadonlySet<string> = new Set(["documentation_pending", "under_analysis"]);
/** No fechamento, a venda precisa de pagamento, transmissão ou carteirinha/nº da proposta. Assinatura e entrevista sozinhas não bastam. */
const CLOSING_PROOF: readonly SaleSignal[] = ["payment", "proposal_transmitted", "card_or_proposal_number"];
/** Em Negociação a prova é mais forte: pagamento ou proposta transmitida. */
const NEGOTIATION_PROOF: readonly SaleSignal[] = ["payment", "proposal_transmitted"];

/** O que fica em qualificationDetails.aiSaleDetected depois da conversão automática (uma vez por lead). */
export type AiSaleDetection = {
  at: string;
  fromStatus: string;
  signals: SaleSignal[];
  evidence: string[];
  reason: string;
  /** O corretor ainda não completou o "Registrar venda" (valor, operadora, vidas). */
  registrationPending: boolean;
};

export type AiSaleDecisionInput = {
  status: string;
  saleCompleted: SaleCompleted;
  /** Modo da IA na empresa: só o automático converte. */
  mode: "auto" | "suggest" | "off";
  hasBroker: boolean;
  /** O dono do lead é diretor: a IA não mexe. */
  ownerIsDirector: boolean;
  /** Já convertido pela IA antes (marcador aiSaleDetected): uma vez por lead. */
  alreadyDetected: boolean;
  /** Uma pessoa já tirou este lead de Convertido: a IA não converte de novo. */
  personMovedOutOfConverted: boolean;
  /** Venda ativa já registrada para o lead. */
  hasActiveSale: boolean;
  /** O corretor desfez um avanço da IA há menos de 7 dias. */
  recentlyUndone?: boolean;
};

export type AiSaleDecision =
  | { convert: true; signals: SaleSignal[]; reason: string }
  | { convert: false; why: string };

export function aiSaleReason(signals: readonly SaleSignal[]) {
  const labels = signals.map((signal) => SALE_SIGNAL_LABELS[signal]);
  return `Venda detectada pela IA: ${labels.join(", ")}`;
}

export function decideAiSaleConversion(input: AiSaleDecisionInput): AiSaleDecision {
  const sale = input.saleCompleted;
  if (sale.status !== "confirmed") return { convert: false, why: "A IA não confirmou a venda." };
  if (!sale.evidence.length) return { convert: false, why: "Venda sem trecho da conversa que comprove." };
  if (input.mode !== "auto") return { convert: false, why: "A empresa não deixa a IA mudar a etapa sozinha." };
  if (input.status === "lost" || input.status === "converted") return { convert: false, why: "Lead já finalizado." };
  if (!input.hasBroker) return { convert: false, why: "Lead sem corretor." };
  if (input.ownerIsDirector) return { convert: false, why: "Lead de diretor: a IA não muda a etapa." };
  if (input.alreadyDetected) return { convert: false, why: "A IA já converteu este lead uma vez." };
  if (input.personMovedOutOfConverted) return { convert: false, why: "Uma pessoa já tirou este lead de Convertido." };
  if (input.hasActiveSale) return { convert: false, why: "Venda já registrada." };
  if (input.recentlyUndone) return { convert: false, why: "O corretor desfez um avanço da IA há pouco." };

  const proof = CLOSING_STATUSES.has(input.status) ? CLOSING_PROOF : input.status === "negotiation" ? NEGOTIATION_PROOF : null;
  if (!proof) return { convert: false, why: "Etapa ainda longe do fechamento." };
  if (!sale.signals.some((signal) => proof.includes(signal))) {
    return { convert: false, why: "Falta prova de pagamento ou de proposta transmitida." };
  }
  // Ordem fixa no motivo: o mais forte primeiro.
  const signals = SALE_SIGNALS.filter((signal) => sale.signals.includes(signal));
  return { convert: true, signals, reason: aiSaleReason(signals) };
}

/** Uma notificação por lead e pessoa: repetir a análise nunca avisa duas vezes. */
export function aiSaleNotificationKey(leadId: string, recipientUserId: string) {
  return `lead-ai-sale:${leadId}:${recipientUserId}`;
}

export type AiSaleMissingInput = {
  /** Documentos obrigatórios ainda sem aprovação (por requisito e beneficiário). */
  pendingRequiredDocuments: number;
  /** Algum documento aprovado que sirva de confirmação da operadora. */
  hasApprovedDocument: boolean;
  monthlyValue: string | number | null;
  hasPlan: boolean;
  livesCount: number | null;
};

/** O que falta para o "Registrar venda": documentos da venda e valor, operadora/plano e vidas. */
export function aiSaleMissingItems(input: AiSaleMissingInput): string[] {
  const items: string[] = [];
  if (input.pendingRequiredDocuments > 0) {
    items.push(input.pendingRequiredDocuments === 1 ? "documentos da venda (1 pendente)" : `documentos da venda (${input.pendingRequiredDocuments} pendentes)`);
  }
  if (!input.hasApprovedDocument) items.push("confirmação da operadora");
  const value = input.monthlyValue === null || input.monthlyValue === "" ? Number.NaN : Number(input.monthlyValue);
  if (!(Number.isFinite(value) && value > 0)) items.push("valor");
  if (!input.hasPlan) items.push("operadora/plano");
  if (!(input.livesCount && input.livesCount > 0)) items.push("vidas");
  return items;
}

/**
 * Parabéns e pedido da documentação da venda ao corretor, numa notificação só. A lista diz o que falta;
 * sem nada faltando, só pede para concluir o registro.
 */
export function aiSaleBrokerNotice(leadName: string | null, missing: readonly string[] = []) {
  const lead = leadName?.trim() || "seu cliente";
  const todo = missing.length
    ? `Envie a documentação da venda e complete no CRM: ${missing.join(", ")}.`
    : "Confira os dados e conclua o Registrar venda.";
  return {
    title: `Parabéns! A venda de ${lead} foi concluída`,
    message: `A IA viu a venda fechada na conversa. ${todo}`,
    pushTitle: "Venda concluída 🎉",
    pushBody: `Parabéns! A venda de ${lead} foi concluída. ${todo}`,
  };
}

export function aiSaleDirectorNotice(input: { leadName: string | null; brokerName: string | null; reason: string; evidence: readonly string[] }) {
  const lead = input.leadName?.trim() || "Cliente";
  const broker = input.brokerName?.trim() || "sem corretor";
  const quote = input.evidence[0] ? ` Trecho: "${input.evidence[0].slice(0, 140)}".` : "";
  return {
    title: `Venda fechada: ${lead}`,
    message: `Corretor: ${broker}. ${input.reason}.${quote} O corretor foi parabenizado e vai completar o registro.`,
    pushTitle: "Venda fechada 🎉",
    pushBody: `${lead} (${broker}). ${input.reason}.`,
  };
}

/** O card "Complete o registro da venda" aparece enquanto o lead segue Convertido pela IA sem venda registrada. */
export function aiSaleRegistrationPending(status: string, details: unknown) {
  if (status !== "converted" || !details || typeof details !== "object") return false;
  const marker = (details as { aiSaleDetected?: Partial<AiSaleDetection> }).aiSaleDetected;
  return Boolean(marker?.registrationPending);
}

// ─── Relatório (leitura antiga) ───────────────────────────────────────

const LEGACY_PATTERNS: Array<{ signal: SaleSignal; pattern: RegExp }> = [
  { signal: "payment", pattern: /(ades[aã]o|1[ªa]? ?mensalidade|primeira mensalidade|boleto|pix)[^.;]{0,40}\b(pag[ao]|paga|quitad[ao]|comprovante)|\b(pagou|paguei|pix feito|comprovante (do pix|de pagamento|enviado))/i },
  { signal: "proposal_transmitted", pattern: /proposta[^.;]{0,40}(transmitida|implantada|enviada [àa] operadora)/i },
  { signal: "card_or_proposal_number", pattern: /(carteirinha|n[uú]mero da proposta|n[ºo°] da proposta)[^.;]{0,30}(emitid|enviad|gerad)/i },
  { signal: "medical_interview_approved", pattern: /entrevista m[eé]dica[^.;]{0,40}aprovad/i },
  { signal: "contract_signed", pattern: /(contrato|proposta)[^.;]{0,20}assinad/i },
];

/**
 * Leitura das análises antigas (sem saleCompleted), só para o relatório de conferência: procura nos fatos e
 * sinais de compra as mesmas provas. Nunca converte; a conversão espera a próxima análise com o campo novo.
 */
export function legacySaleSignals(assessment: { facts?: unknown; buyingSignals?: unknown; directorBrief?: unknown } | null | undefined) {
  if (!assessment) return { signals: [] as SaleSignal[], evidence: [] as string[] };
  const texts = [
    ...(Array.isArray(assessment.facts) ? assessment.facts : []),
    ...(Array.isArray(assessment.buyingSignals) ? assessment.buyingSignals : []),
    typeof assessment.directorBrief === "string" ? assessment.directorBrief : "",
  ].filter((text): text is string => typeof text === "string" && text.trim().length > 0);
  const signals = new Set<SaleSignal>();
  const evidence: string[] = [];
  for (const text of texts) {
    // "Carteirinha ainda não emitida" não é prova.
    if (/\bn[aã]o\b|\bainda\b|pendente|aguardando/i.test(text) && !/pag|transmit/i.test(text)) continue;
    for (const { signal, pattern } of LEGACY_PATTERNS) {
      if (pattern.test(text)) {
        signals.add(signal);
        if (!evidence.includes(text)) evidence.push(text);
      }
    }
  }
  return { signals: SALE_SIGNALS.filter((signal) => signals.has(signal)), evidence: evidence.slice(0, 5) };
}
