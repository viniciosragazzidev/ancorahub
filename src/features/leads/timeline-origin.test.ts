import { describe, expect, it } from "vitest";

import { classifyTimelineOrigin, filterTimelineByOrigin, isTimelineOriginFilter, timelineFilterStorageKey, type TimelineOriginInput } from "./timeline-origin";

const item = (over: Partial<TimelineOriginInput>): TimelineOriginInput => ({ tipo: "note", conteudo: "", userId: "u1", userName: "Ana", ...over });

describe("classifyTimelineOrigin", () => {
  it("usa metadata.source antes de tudo", () => {
    expect(classifyTimelineOrigin(item({ tipo: "status_change", metadata: { source: "AI" }, conteudo: "Status alterado" }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ tipo: "status_change", metadata: { source: "AI_SALE_DETECTED" } }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ tipo: "status_change", metadata: { source: "STALE_RULE" } }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ metadata: { source: "post_sale_audit" } }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ metadata: { source: "USER_ACCEPTED_AI_SUGGESTION" }, conteudo: "Sugestão da IA aceita: A → B." }))).toBe("team");
    expect(classifyTimelineOrigin(item({ metadata: { source: "USER_UNDID_AI_MOVE" } }))).toBe("team");
    expect(classifyTimelineOrigin(item({ metadata: { source: "extension" } }))).toBe("team");
    expect(classifyTimelineOrigin(item({ metadata: { source: "call_ancora" } }))).toBe("team");
  });

  it("documentos, cotação e início de atendimento são da equipe", () => {
    expect(classifyTimelineOrigin(item({ tipo: "quote_generated", conteudo: "Cotação gerada" }))).toBe("team");
    expect(classifyTimelineOrigin(item({ tipo: "document_upload" }))).toBe("team");
    expect(classifyTimelineOrigin(item({ tipo: "service_started", conteudo: "Atendimento iniciado automaticamente pela primeira mensagem enviada no chat." }))).toBe("team");
  });

  it("reconhece ações da IA pelo texto", () => {
    expect(classifyTimelineOrigin(item({ conteudo: "Qualificação automática concluída. Plano individual." }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Capacidade [send_quote] Enviar cotação executada com sucesso. RiskLevel: low." }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ conteudo: "⚠️ A primeira mensagem do atendimento virtual não chegou ao WhatsApp do lead." }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ conteudo: "📝 O cliente corrigiu os dados depois da qualificação: idade." }))).toBe("ai");
    expect(classifyTimelineOrigin(item({ conteudo: "Pergunta para a direção enviada pela Sasá." }))).toBe("ai");
  });

  it("reconhece distribuição, SLA, gatilhos e webhooks como automático", () => {
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Gatilho [no_reply] executado com sucesso: Sem resposta." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Alerta de SLA: Ausência de registro de primeiro contato/feedback dentro do prazo." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Tempo limite da qualificação excedido (30 min)." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ conteudo: "Lead recebido por webhook e encaminhado pelo motor central de distribuição." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ conteudo: "📞 Lead sem WhatsApp: o número não recebe mensagens no WhatsApp. Atenda por ligação." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Lead criado e distribuído automaticamente para um corretor disponível." }))).toBe("automatic");
  });

  it("regra de etapa que cita a IA continua automática", () => {
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Lead retornado para a fila de qualificação pois a qualificação por IA está ativa e a etapa exige qualificação prévia." }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Etapa atualizada com a marcação 'IA Desativada' para diferenciar da qualificação automatizada." }))).toBe("automatic");
  });

  it("ação manual que cita IA ou SLA é da equipe", () => {
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Qualificação por Agente de IA iniciada manualmente. Primeira mensagem enviada no WhatsApp." }))).toBe("team");
    expect(classifyTimelineOrigin(item({ conteudo: "[RESET DA IA] Memória da IA reiniciada por solicitação administrativa. Motivo: teste" }))).toBe("team");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Lead reatribuído por Diretor; atendimento e SLA reiniciados, com histórico preservado." }))).toBe("team");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Ana assumiu o lead parado no radar Esfriando." }))).toBe("team");
    expect(classifyTimelineOrigin(item({ conteudo: "Lead importado via arquivo CSV e encaminhado para o processo de Qualificação IA." }))).toBe("team");
    expect(classifyTimelineOrigin(item({ conteudo: "Corretor recusou o lead para redistribuição. Motivo: fora da área" }))).toBe("team");
  });

  it("sem certeza: equipe com usuário, automático sem usuário", () => {
    expect(classifyTimelineOrigin(item({ tipo: "status_change", conteudo: "Status alterado: Novo → Em contato" }))).toBe("team");
    expect(classifyTimelineOrigin(item({ tipo: "system_alert", conteudo: "Algo aconteceu", userId: null, userName: null }))).toBe("automatic");
    expect(classifyTimelineOrigin(item({ tipo: "note", conteudo: "", metadata: ["x"], userId: null, userName: null }))).toBe("automatic");
  });
});

describe("filterTimelineByOrigin", () => {
  const items = [
    item({ conteudo: "Ligação feita" }),
    item({ conteudo: "Qualificação automática concluída." }),
    item({ tipo: "system_alert", conteudo: "Alerta de SLA: atraso" }),
  ];

  it("Tudo mantém a ordem e o resto filtra", () => {
    expect(filterTimelineByOrigin(items, "all")).toHaveLength(3);
    expect(filterTimelineByOrigin(items, "team").map((i) => i.conteudo)).toEqual(["Ligação feita"]);
    expect(filterTimelineByOrigin(items, "ai").map((i) => i.conteudo)).toEqual(["Qualificação automática concluída."]);
    expect(filterTimelineByOrigin(items, "automatic").map((i) => i.conteudo)).toEqual(["Alerta de SLA: atraso"]);
  });

  it("valida o valor salvo e separa a chave por usuário", () => {
    expect(isTimelineOriginFilter("ai")).toBe(true);
    expect(isTimelineOriginFilter("robo")).toBe(false);
    expect(isTimelineOriginFilter(null)).toBe(false);
    expect(timelineFilterStorageKey("u1")).not.toBe(timelineFilterStorageKey("u2"));
  });
});
