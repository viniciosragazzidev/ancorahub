import { describe, expect, it, vi } from "vitest";

import { getDefaultQuickReplyTemplates, isRetiredDefaultBody } from "@/features/ai-agent/quick-reply";
import { withBrokerReturnPhrase } from "./broker-window";
import {
  AFTER_HOURS_HUMAN_REQUEST_TEXT,
  AFTER_HOURS_QUALIFIED_HANDOFF_TEXT,
  DEFAULT_HUMAN_REQUEST_TEXT,
  DEFAULT_QUALIFIED_HANDOFF_TEXT,
  effectiveHandoffText,
} from "./reply-composer";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({}), schema: {} }));
vi.mock("@/features/ai-qualification/tenant-settings-service", () => ({ getQualificationTenantSettings: async () => null }));

import { CLOSING_AFTER_HOURS_TEXT, CLOSING_DEFAULT_TEXT, effectiveFinalMessage } from "@/features/ai-qualification/closing-state-service";

/** Sentences: text split on . ! ? with content in front of each. */
function sentences(text: string) {
  return text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
}

/** A Wednesday at 20h in São Paulo (the "amanhã" phrase) and at 10h (the "em instantes" phrase). */
const WEDNESDAY_NIGHT = new Date(Date.UTC(2026, 9, 21, 23, 0));
const WEDNESDAY_DAY = new Date(Date.UTC(2026, 9, 21, 13, 0));

const customerTexts = {
  "resposta de encerramento, com nome e resumo": [
    DEFAULT_QUALIFIED_HANDOFF_TEXT.replace("{{nome}}", "Ana").replace("{{resumo}}", "individual, 40 anos"),
    DEFAULT_HUMAN_REQUEST_TEXT.replace("{{nome}}", "Ana").replace("{{resumo}}", "individual, 40 anos"),
    withBrokerReturnPhrase(AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, WEDNESDAY_NIGHT).replace("{{nome}}", "Ana").replace("{{resumo}}", "individual, 40 anos"),
    withBrokerReturnPhrase(AFTER_HOURS_HUMAN_REQUEST_TEXT, WEDNESDAY_NIGHT).replace("{{nome}}", "Ana").replace("{{resumo}}", "individual, 40 anos"),
    withBrokerReturnPhrase(CLOSING_AFTER_HOURS_TEXT, WEDNESDAY_NIGHT).replace("{{firstName}}", "Ana"),
    withBrokerReturnPhrase(CLOSING_DEFAULT_TEXT, WEDNESDAY_DAY).replace("{{firstName}}", "Ana"),
  ],
};

describe("textos de encerramento e handoff", () => {
  it("nenhum texto novo tem travessão, emoji ou mais de uma pergunta", () => {
    for (const text of customerTexts["resposta de encerramento, com nome e resumo"]) {
      expect(text).not.toMatch(/[—–]/);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text.split("?").length - 1).toBeLessThanOrEqual(1);
    }
  });

  it("cada mensagem tem no máximo 3 frases", () => {
    for (const text of customerTexts["resposta de encerramento, com nome e resumo"]) {
      expect(sentences(text).length).toBeLessThanOrEqual(3);
    }
  });

  it("fora do horário, o texto diz quando o corretor volta, e não sobra modelo", () => {
    expect(withBrokerReturnPhrase(AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, WEDNESDAY_NIGHT)).toContain("por aqui amanhã, a partir das 9h.");
    expect(withBrokerReturnPhrase(AFTER_HOURS_HUMAN_REQUEST_TEXT, WEDNESDAY_NIGHT)).toContain("por aqui amanhã, a partir das 9h, sem você precisar repetir nada.");
    expect(withBrokerReturnPhrase(CLOSING_AFTER_HOURS_TEXT, WEDNESDAY_NIGHT)).not.toContain("{{quando}}");
  });

  it("o texto de dia não promete o que só vale fora do horário", () => {
    expect(DEFAULT_QUALIFIED_HANDOFF_TEXT).toContain("em instantes");
    expect(DEFAULT_HUMAN_REQUEST_TEXT).toContain("em instantes");
    expect(DEFAULT_QUALIFIED_HANDOFF_TEXT).not.toMatch(/amanhã|próximo dia útil/);
  });

  it("texto antigo salvo pelo tenant volta para o padrão novo, e o texto escrito pelo diretor fica", () => {
    expect(effectiveHandoffText("Obrigado, {{nome}}! Com essas informações ({{resumo}}), já passei seu atendimento para um corretor especialista. Ele continua a conversa por aqui em instantes.", DEFAULT_QUALIFIED_HANDOFF_TEXT)).toBe(DEFAULT_QUALIFIED_HANDOFF_TEXT);
    expect(effectiveHandoffText("Vou encaminhar você para um corretor da equipe agora.", DEFAULT_HUMAN_REQUEST_TEXT)).toBe(DEFAULT_HUMAN_REQUEST_TEXT);
    expect(effectiveHandoffText("Texto que a corretora escreveu.", DEFAULT_HUMAN_REQUEST_TEXT)).toBe("Texto que a corretora escreveu.");
  });

  it("encerramento: o texto antigo do banco volta para o padrão novo; o do diretor fica", () => {
    expect(effectiveFinalMessage("Obrigado! Um corretor continuará seu atendimento em seguida.")).toBe(CLOSING_DEFAULT_TEXT);
    expect(effectiveFinalMessage("Obrigado pelas informações, {{firstName}}! Sua qualificação foi concluída e um de nossos corretores entrará em contato em instantes.")).toBe(CLOSING_DEFAULT_TEXT);
    expect(effectiveFinalMessage(null)).toBe(CLOSING_DEFAULT_TEXT);
    expect(effectiveFinalMessage("Recebemos tudo, falamos em breve.")).toBe("Recebemos tudo, falamos em breve.");
  });

  it("sem nome, o encerramento não sai com nome vazio", () => {
    expect(withBrokerReturnPhrase(CLOSING_DEFAULT_TEXT.replace(", {{firstName}}", ""), WEDNESDAY_DAY)).toBe("Obrigado pelas informações! Está tudo anotado. Um corretor vai falar com você por aqui em instantes.");
  });
});

describe("respostas rápidas", () => {
  const templates = getDefaultQuickReplyTemplates();

  it("nenhum texto padrão de resposta rápida tem travessão, emoji ou mais de 3 frases", () => {
    for (const template of Object.values(templates)) {
      expect(template.body).not.toMatch(/[—–]/);
      expect(template.body).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(sentences(template.body).length).toBeLessThanOrEqual(3);
    }
  });

  it("os textos antigos continuam reconhecidos como aposentados, para tenants que salvaram o padrão", () => {
    expect(isRetiredDefaultBody("faq.price", "O valor depende principalmente da idade, da cidade e do tipo de plano. Com essas respostas o corretor já te manda as opções com preço.")).toBe(true);
    expect(isRetiredDefaultBody("opt_out.confirmed", "Entendido. Registrei sua solicitação e o atendimento automático será interrompido.")).toBe(true);
    expect(isRetiredDefaultBody("human.requested", "Claro, {{nome}}! Já passei seu atendimento para um corretor especialista com o que você me contou ({{resumo}}). Ele continua a conversa por aqui em instantes.")).toBe(true);
  });

  it("o texto escrito pelo diretor não é aposentado", () => {
    expect(isRetiredDefaultBody("opt_out.confirmed", "Registrei seu pedido, obrigada.")).toBe(false);
  });

  it("o opt-out continua registrando o pedido, sem prometer apagar dados", () => {
    expect(templates["opt_out.confirmed"]?.body).toContain("Registrei seu pedido");
    expect(templates["opt_out.confirmed"]?.body).not.toMatch(/apag|exclu|remov/i);
  });
});
