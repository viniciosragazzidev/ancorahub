import { describe, expect, it } from "vitest";

import { builtInNoticeVariants } from "@/features/team-notices/variants";
import { teamNoticeForPurpose } from "@/features/team-notices/catalog";
import { getMessageEventByPurpose } from "@/features/communication-channels/message-event-catalog";
import {
  closingDealLine,
  closingDirectorAlertKey,
  closingDirectorAlertVariables,
  formatRecipientPhone,
  normalizeRecipientPhone,
  parseRecipientPhones,
} from "./closing-director-alert-core";

describe("fechamento para a direção", () => {
  it("normaliza o número com ou sem +55 e descarta o inválido", () => {
    expect(normalizeRecipientPhone("+55 21 96462-5966")).toBe("5521964625966");
    expect(normalizeRecipientPhone("(21) 96462-5966")).toBe("5521964625966");
    expect(normalizeRecipientPhone("2133334444")).toBe("552133334444");
    expect(normalizeRecipientPhone("12345")).toBeNull();
    expect(formatRecipientPhone("5521964625966")).toBe("(21) 96462-5966");
  });

  it("lê a lista salva (JSON) ou digitada, sem repetir", () => {
    expect(parseRecipientPhones(JSON.stringify(["5521964625966", "(21) 96462-5966", "x"]))).toEqual(["5521964625966"]);
    expect(parseRecipientPhones("21 96462-5966; 21 99999-0000")).toEqual(["5521964625966", "5521999990000"]);
    expect(parseRecipientPhones(null)).toEqual([]);
  });

  it("uma chave por lead e número", () => {
    expect(closingDirectorAlertKey("lead-1", "5521964625966")).toBe("lead-closing-director:lead-1:5521964625966");
  });

  it("monta a linha do negócio só com o que está preenchido", () => {
    expect(closingDealLine({ leadType: "PF", livesCount: 2, monthlyValue: "890.5", planName: "Amil 400" }).replace(/ /g, " ")).toBe("Pessoa física · 2 vidas · Amil 400 · R$ 890,50/mês");
    expect(closingDealLine({ leadType: null, livesCount: null, monthlyValue: null, planName: null })).toBe("Sem valor e vidas registrados ainda");
  });

  it("variáveis na ordem do evento, dentro do limite de 512 do envio", () => {
    const variables = closingDirectorAlertVariables({
      leadId: "lead-1", leadName: "Maria Souza", leadPhone: "21999990000", leadType: "PJ", livesCount: 1, monthlyValue: null,
      planName: null, brokerName: "Ana Lima", stage: "under_analysis", summary: "x".repeat(900),
    });
    expect(variables.slice(0, 5)).toEqual(["Maria Souza", "(21) 99999-0000", "Empresa (PJ) · 1 vida", "Ana Lima", "Em análise"]);
    expect(variables[5]!.length).toBeLessThanOrEqual(500);
    expect(variables[6]).toBe("lead-1");
    expect(getMessageEventByPurpose("leadClosingDirectorAlert")?.variables).toHaveLength(variables.length);
    expect(variables.every((value) => value.length >= 1 && value.length <= 512)).toBe(true);
  });

  it("é um aviso imediato pelo WhatsApp da empresa, com texto em 4 versões", () => {
    const notice = teamNoticeForPurpose("leadClosingDirectorAlert");
    expect(notice?.class).toBe("critical");
    expect(notice?.defaultChannel).toBe("company_number");
    expect(notice?.phoneRecipients).toBe(true);
    const versions = builtInNoticeVariants({
      purpose: "leadClosingDirectorAlert", lead: "Maria", phone: "(21) 99999-0000", deal: "Pessoa física", broker: "Ana",
      stage: "Documentação", summary: "Resumo da conversa.", link: "https://crm.ancorasaude.cloud/leads/lead-1",
    }, 10);
    expect(versions).toHaveLength(4);
    for (const text of versions) {
      expect(text).toContain("Maria");
      expect(text).toContain("Ana");
      expect(text).toContain("Resumo da conversa.");
      expect(text).toContain("/leads/lead-1");
    }
  });
});
