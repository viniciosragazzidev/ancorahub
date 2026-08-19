import { describe, expect, it } from "vitest";

import { SYSTEM_REPORT_TRIGGERS, buildSystemReportMessage, getSystemReportTrigger } from "./message";

describe("system report message", () => {
  it("exposes five generic triggers with stable ids", () => {
    expect(SYSTEM_REPORT_TRIGGERS).toHaveLength(5);
    expect(SYSTEM_REPORT_TRIGGERS.map((trigger) => trigger.id)).toEqual([
      "bug_erro",
      "problema_leads",
      "falha_whatsapp",
      "permissao_acesso",
      "outro",
    ]);
  });

  it("resolves a trigger by id and returns null for unknown ids", () => {
    expect(getSystemReportTrigger("falha_whatsapp")?.label).toBe("Falha no WhatsApp ou envio");
    expect(getSystemReportTrigger("inexistente")).toBeNull();
  });

  it("builds the WhatsApp body with cargo, nome, titulo and mensagem", () => {
    const body = buildSystemReportMessage({
      cargo: "Corretor",
      nome: "Ana Souza",
      titulo: "Bug ou erro no sistema",
      mensagem: "O painel de leads não carrega após a atualização.",
    });
    expect(body).toBe(
      [
        "*REPORT SISTEMA*",
        "*Corretor*: Ana Souza",
        "_Bug ou erro no sistema_",
        "O painel de leads não carrega após a atualização.",
      ].join("\n"),
    );
  });

  it("trims the mensagem before composing the body", () => {
    const body = buildSystemReportMessage({
      cargo: "Gestor",
      nome: "Bruno Lima",
      titulo: "Outro assunto ou sugestão",
      mensagem: "   Sugestão de novo filtro.  ",
    });
    expect(body.endsWith("Sugestão de novo filtro.")).toBe(true);
    expect(body).not.toContain("   ");
  });
});