/**
 * Linha do tempo da qualificação (drawer de /qualificacao/leads): junta mensagens, toques da cadência, marcos do
 * funil, auditoria e os dados coletados pela IA numa lista só, do mais recente para o mais antigo. Pura.
 */

export type TimelineKind = "ai" | "customer" | "touch" | "data" | "stage" | "alert";

export type TimelineItem = {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string | null;
  /** Canal (Meta, WAHA) quando é mensagem ou toque. */
  channel: string | null;
  /** Resultado curto ("Enviado", "Pulado: template não aprovado", "Falhou"). */
  outcome: string | null;
};

export type TimelineSource = {
  messages: Array<{ id: string; direction: string; sender_role: string | null; body: string | null; provider: string | null; provider_status: string | null; sent_at: string | Date | null }>;
  events: Array<{ event: string; step_key: string | null; occurred_at: string | Date; metadata: unknown }>;
  audits: Array<{ acao: string; created_at: string | Date }>;
  turbo: unknown;
  memory: unknown;
};

const TOUCH_LABEL: Record<string, string> = {
  t0: "1ª mensagem",
  t1: "Lembrete T1 (20 min)",
  t2: "Lembrete T2 (3 h)",
  t3: "Lembrete T3 (dia seguinte)",
  t4: "Lembrete T4 (despedida)",
  reactivation: "Reativação",
};

const SKIP_LABEL: Record<string, string> = {
  template_not_approved: "template não aprovado na Meta",
  stale: "passou da hora",
  held: "retido pela fila de envio",
  "131049": "limite de marketing da Meta (131049)",
};

const FIELD_LABEL: Record<string, string> = {
  planType: "Tipo de plano",
  numberOfLives: "Vidas",
  age: "Idades",
  averageAge: "Média de idade",
  city: "Cidade",
  neighborhood: "Bairro",
  customerName: "Nome",
  email: "E-mail",
  companyHasCnpj: "CNPJ",
  currentPlan: "Plano atual",
  intent: "Intenção",
};

const EVENT_LABEL: Record<string, string> = {
  qualification_result: "Resultado da qualificação",
  stage_entered: "Mudou de etapa",
};
const RESULT_LABEL: Record<string, string> = { QUALIFIED: "Quente", PARTIAL: "Parcial", NOT_INTERESTED: "Sem interesse", DISQUALIFIED: "Sem perfil" };

const AUDIT_LABEL: Record<string, string> = {
  "qualification.timeout_manual_hold": "Virou frio e ficou segurado",
  "qualification.timeout_queued": "Virou frio e foi para a fila",
  "qualification.silence_follow_up_sent": "Follow-up de silêncio enviado",
  "qualification.silence_follow_up_failed": "Follow-up de silêncio falhou",
  "recovery.touch_sent": "Toque de recuperação enviado",
  "recovery.call_queue": "Foi para a fila de ligação",
  "recovery.bad_moment": "Marcado como momento ruim",
  "recovery.do_not_contact": "Marcado como não contatar",
};

const CHANNEL_LABEL: Record<string, string> = { meta: "Meta", meta_cloud: "Meta", waha: "WAHA" };

function iso(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function humanize(key: string) {
  return key.replace(/^[a-z]+\./, "").replace(/[_.]/g, " ").replace(/^./, (char) => char.toUpperCase());
}

/** "Cotação..." curto para caber no drawer. */
function clip(text: string | null | undefined, max = 220) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function buildTimeline(source: TimelineSource): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const message of source.messages) {
    const at = iso(message.sent_at);
    if (!at) continue;
    const inbound = message.direction === "incoming" || message.direction === "inbound";
    const silence = message.id.startsWith("ai_silence_followup_");
    const failed = message.provider_status === "failed";
    items.push({
      id: `m:${message.id}`,
      at,
      kind: inbound ? "customer" : silence ? "touch" : "ai",
      title: inbound ? "Cliente" : silence ? "Follow-up de silêncio" : message.sender_role === "assistant" ? "IA" : "Equipe",
      detail: clip(message.body),
      channel: CHANNEL_LABEL[message.provider ?? ""] ?? (inbound ? null : "Meta"),
      outcome: failed ? "Falhou" : null,
    });
  }

  const turbo = source.turbo && typeof source.turbo === "object" ? (source.turbo as { touches?: Array<{ touch?: string; status?: string; at?: string; errorCode?: string | null; template?: string | null }>; stoppedAt?: string; stopReason?: string }) : null;
  for (const [index, touch] of (turbo?.touches ?? []).entries()) {
    const at = iso(touch.at);
    if (!at || !touch.touch || touch.touch === "t0") continue;
    const outcome = touch.status === "sent" ? "Enviado"
      : touch.status === "skipped" ? `Pulado: ${SKIP_LABEL[touch.errorCode ?? ""] ?? touch.errorCode ?? "sem motivo"}`
      : `Falhou${touch.errorCode ? `: ${SKIP_LABEL[touch.errorCode] ?? touch.errorCode}` : ""}`;
    items.push({ id: `t:${index}`, at, kind: "touch", title: TOUCH_LABEL[touch.touch] ?? touch.touch, detail: touch.template ?? null, channel: "Meta", outcome });
  }
  const stoppedAt = iso(turbo?.stoppedAt);
  if (stoppedAt) {
    const reason: Record<string, string> = { replied: "o cliente respondeu", opt_out: "pediu para sair", human: "uma pessoa assumiu", assigned: "recebeu corretor", closed: "lead encerrado", finished: "fim dos lembretes", meta_limit: "limite da Meta" };
    items.push({ id: "t:stop", at: stoppedAt, kind: "stage", title: "Lembretes pararam", detail: reason[turbo?.stopReason ?? ""] ?? turbo?.stopReason ?? null, channel: null, outcome: null });
  }

  // Dados coletados pela IA: o marco "question_answered" do funil dá a hora; o valor vem da memória.
  // Sem o marco, a hora é a da mensagem que deu o dado (`sourceMessageId`).
  const memory = source.memory && typeof source.memory === "object" ? (source.memory as Record<string, unknown>) : null;
  const valueOf = (key: string) => {
    const field = memory?.[key] as { value?: unknown } | undefined;
    return field && field.value !== undefined && field.value !== null && field.value !== "" ? clip(String(field.value), 80) : null;
  };
  const messageAt = new Map(source.messages.map((message) => [message.id, iso(message.sent_at)]));
  const answered = new Set<string>();
  for (const [index, event] of source.events.entries()) {
    const at = iso(event.occurred_at);
    if (!at) continue;
    if (event.event === "question_answered" && event.step_key) {
      answered.add(event.step_key);
      items.push({ id: `e:${index}`, at, kind: "data", title: `Dado: ${FIELD_LABEL[event.step_key] ?? event.step_key}`, detail: valueOf(event.step_key), channel: null, outcome: null });
      continue;
    }
    items.push({ id: `e:${index}`, at, kind: "stage", title: EVENT_LABEL[event.event] ?? humanize(event.event), detail: event.step_key ? RESULT_LABEL[event.step_key] ?? event.step_key : null, channel: null, outcome: null });
  }
  for (const [key, label] of Object.entries(FIELD_LABEL)) {
    if (answered.has(key)) continue;
    const field = memory?.[key] as { sourceMessageId?: string } | undefined;
    const at = field?.sourceMessageId ? messageAt.get(field.sourceMessageId) : null;
    const value = valueOf(key);
    if (!at || !value) continue;
    items.push({ id: `d:${key}`, at, kind: "data", title: `Dado: ${label}`, detail: value, channel: null, outcome: null });
  }

  for (const [index, audit] of source.audits.entries()) {
    const at = iso(audit.created_at);
    if (!at) continue;
    const [action, extra] = audit.acao.split(":");
    // O follow-up de silêncio já aparece pela mensagem.
    if (action === "qualification.silence_follow_up_sent") continue;
    const alert = /failed|opt_out|wrong|meta_limit|do_not_contact/.test(audit.acao);
    items.push({ id: `a:${index}`, at, kind: alert ? "alert" : "stage", title: AUDIT_LABEL[action] ?? humanize(action), detail: extra ? CHANNEL_LABEL[extra] ?? extra : null, channel: null, outcome: null });
  }

  // Mesma hora: o dado aparece acima da mensagem que o trouxe.
  return items.sort((a, b) => b.at.localeCompare(a.at) || Number(b.kind === "data") - Number(a.kind === "data"));
}
