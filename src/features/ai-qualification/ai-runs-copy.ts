/**
 * Textos das execuções da IA (/ia/execucoes, 25/11/2026, item "Execuções" de
 * docs/research/deskcomm-crm-engenharia-reversa.md §7.3). Regra pura e testada: o erro técnico do provedor vira
 * "o que aconteceu" e "o que fazer" em frases curtas; o texto original fica recolhido na gaveta.
 */

/** Situações gravadas em ai_attendance_logs.status. */
export type AiRunStatus = "success" | "failed" | "fallback" | "delivery_failed";

/** Contam como falha no resumo e no filtro "Só falhas". A resposta reserva chegou ao cliente: não é falha. */
export const AI_RUN_FAILURE_STATUSES = ["failed", "delivery_failed"] as const;

export function isAiRunFailure(status: string) {
  return (AI_RUN_FAILURE_STATUSES as readonly string[]).includes(status);
}

export type AiRunStatusView = { label: string; tone: "success" | "warning" | "danger" | undefined };

/** Situação com texto (status nunca só por cor). */
export function aiRunStatusView(status: string): AiRunStatusView {
  if (status === "success") return { label: "Respondeu", tone: "success" };
  if (status === "fallback") return { label: "Resposta reserva", tone: "warning" };
  if (status === "delivery_failed") return { label: "Não entregue", tone: "danger" };
  if (status === "failed") return { label: "Falhou", tone: "danger" };
  return { label: "Sem situação", tone: undefined };
}

export type AiRunErrorKind = "rate_limit" | "timeout" | "invalid_key" | "content_refused" | "whatsapp_disconnected" | "provider";

export type AiRunExplanation = {
  kind: AiRunErrorKind | "none";
  /** O que aconteceu, em uma frase. */
  title: string;
  /** O que fazer agora. */
  whatToDo: string;
  /** Tela onde se resolve, quando há uma. */
  href?: string;
  hrefLabel?: string;
};

const CONNECTIVITY = { href: "/qualificacao?tab=whatsapp_diag", hrefLabel: "Abrir Conectividade" };

/** Ordem importa: o WhatsApp vem antes do 401/403 genérico, e o tempo esgotado antes do erro do provedor. */
const RULES: Array<{ kind: AiRunErrorKind; test: RegExp }> = [
  { kind: "whatsapp_disconnected", test: /whats ?app|waha|scan_qr|qr code|session (is )?(not|stopped|failed)|not connected|disconnected|desconect|instance (not|is not)/i },
  { kind: "rate_limit", test: /\b429\b|rate[ _-]?limit|too many requests|quota|insufficient[_ ]credits|limite de (uso|requisi)/i },
  { kind: "timeout", test: /time(d)?[ _-]?out|etimedout|esockettimedout|deadline|aborted|aborterror|tempo esgotado|\b504\b/i },
  { kind: "invalid_key", test: /\b401\b|\b403\b|invalid[_ ]?(api[_ ]?)?key|incorrect api key|unauthori[sz]ed|authentication|no auth credentials|chave (inv[aá]lida|recusada)/i },
  { kind: "content_refused", test: /content[_ ]?(policy|filter|management)|moderation|flagged|safety|refus|guardrail|bloquead/i },
];

const COPY: Record<AiRunErrorKind, Omit<AiRunExplanation, "kind">> = {
  rate_limit: {
    title: "Limite do provedor",
    whatToDo: "O provedor da IA recusou por excesso de pedidos. A próxima mensagem costuma sair. Se repetir por mais de uma hora, avise o suporte.",
  },
  timeout: {
    title: "Tempo esgotado",
    whatToDo: "A IA demorou demais para responder. Veja se o lead ficou sem resposta em Leads na qualificação.",
    href: "/qualificacao/leads",
    hrefLabel: "Abrir Leads na qualificação",
  },
  invalid_key: {
    title: "Chave inválida",
    whatToDo: "O provedor recusou a chave da IA. Avise o suporte da plataforma para trocar a chave.",
  },
  content_refused: {
    title: "Conteúdo recusado",
    whatToDo: "O provedor recusou o texto da conversa. Peça para um corretor atender esse lead.",
  },
  whatsapp_disconnected: {
    title: "WhatsApp desconectado",
    whatToDo: "A resposta não chegou ao cliente. Reconecte o número em Conectividade.",
    ...CONNECTIVITY,
  },
  provider: {
    title: "Erro do provedor",
    whatToDo: "O provedor da IA falhou sem dizer o motivo. Se repetir, confira Conectividade ou avise o suporte.",
    ...CONNECTIVITY,
  },
};

/** Tipo do erro a partir do texto técnico; sem texto reconhecível, "provider". */
export function classifyAiRunError(errorMessage: string | null | undefined): AiRunErrorKind {
  const text = (errorMessage ?? "").trim();
  if (!text) return "provider";
  return RULES.find((rule) => rule.test.test(text))?.kind ?? "provider";
}

/** "O que aconteceu" e "O que fazer" de uma execução. Execução que deu certo não tem erro para explicar. */
export function explainAiRun(run: { status: string; errorMessage: string | null | undefined }): AiRunExplanation {
  if (run.status === "success") {
    return { kind: "none", title: "A IA respondeu o cliente", whatToDo: "Nada a fazer." };
  }
  // Não entregue sem texto: o motor respondeu, mas o envio pelo WhatsApp não saiu.
  const kind = run.status === "delivery_failed" && !run.errorMessage?.trim() ? "whatsapp_disconnected" : classifyAiRunError(run.errorMessage);
  const copy = COPY[kind];
  if (run.status === "fallback") {
    return {
      kind,
      ...copy,
      title: `Resposta reserva: ${copy.title.toLowerCase()}`,
      whatToDo: `O cliente recebeu a resposta pronta das regras, sem a IA. ${copy.whatToDo}`,
    };
  }
  return { kind, ...copy };
}

/** Resumo do topo: "Nenhuma falha nas últimas 24 h" ou "N de M falharam nas últimas 24 h". */
export function summarizeAiRuns(total: number, failed: number) {
  if (total <= 0) return "Nenhuma execução nas últimas 24 h";
  if (failed <= 0) return "Nenhuma falha nas últimas 24 h";
  return `${failed.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${failed === 1 ? "falhou" : "falharam"} nas últimas 24 h`;
}

const PURPOSE_LABEL: Record<string, string> = {
  openrouter: "Resposta ao lead",
  deterministic_qualification: "Pergunta da qualificação",
  qualification_fallback: "Resposta reserva",
  qualification_context_analysis: "Leitura da resposta",
  qualification_verification: "Conferência da qualificação",
  lateral_answer: "Dúvida fora do roteiro",
  audio_transcription: "Áudio do lead",
  post_sale_interpretation: "Pós-venda",
  conversation_intelligence: "Resumo da conversa",
};

/** Para que a IA foi chamada (coluna provider guarda o uso desde ai-usage-log.ts). */
export function aiRunPurposeLabel(purpose: string) {
  return PURPOSE_LABEL[purpose] ?? "Outro uso da IA";
}

/** Tempo da execução: "850 ms", "2,4 s". Sem medida, "Sem medida". */
export function formatAiRunLatency(ms: number | null | undefined) {
  if (!ms || ms <= 0) return "Sem medida";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}
