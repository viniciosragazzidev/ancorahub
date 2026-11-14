import { describe, expect, it } from "vitest";

import { LEAD_NOTICE_TITLES, isGenericLeadTitle, leadNoticeTitle, nextLeadNoticeTitle } from "./notice-titles";

describe("títulos do aviso de lead novo", () => {
  it("nunca repete o último título", () => {
    for (let i = 0; i < 20; i += 1) {
      const last = LEAD_NOTICE_TITLES[i % LEAD_NOTICE_TITLES.length];
      expect(nextLeadNoticeTitle(last, () => i / 20)).not.toBe(last);
    }
  });

  it("só troca o título genérico; o título com informação fica", () => {
    expect(isGenericLeadTitle("Novo lead recebido")).toBe(true);
    expect(leadNoticeTitle("n-info", "Maria Souza quer uma cotação")).toBe("Maria Souza quer uma cotação");
  });

  it("devolve o mesmo título para o mesmo aviso e outro para o seguinte", () => {
    const first = leadNoticeTitle("n1", "Novo lead recebido");
    expect(leadNoticeTitle("n1", "Novo lead recebido")).toBe(first);
    expect(leadNoticeTitle("n2", "Novo lead recebido")).not.toBe(first);
  });
});
