import { describe, expect, it } from "vitest";

import {
  buildMetaTemplateComponents,
  recreateMetaTemplateInputSchema,
} from "./template-recreation";

describe("template recreation", () => {
  it("converts named variables once and preserves repeated-variable semantics", () => {
    const input = recreateMetaTemplateInputSchema.parse({
      name: "broker_first_access",
      bodyText: "Olá {{nome}}, sua empresa é {{empresa}}. Até logo, {{nome}}.",
    });

    expect(buildMetaTemplateComponents(input)[0]).toMatchObject({
      type: "BODY",
      text: "Olá {{1}}, sua empresa é {{2}}. Até logo, {{1}}.",
      example: { body_text: [["João Silva", "Âncora Saúde"]] },
    });
  });

  it("preserves existing positional variables and requires a sequential contract", () => {
    const input = recreateMetaTemplateInputSchema.parse({ name: "existing", bodyText: "Olá {{1}}, {{2}}." });
    expect(buildMetaTemplateComponents(input)[0]).toMatchObject({ type: "BODY", text: "Olá {{1}}, {{2}}." });

    const invalid = recreateMetaTemplateInputSchema.parse({ name: "invalid", bodyText: "Olá {{2}}." });
    expect(() => buildMetaTemplateComponents(invalid)).toThrow("sequenciais");
  });

  it("preserves buttons and upgrades only the legacy CRM URL", () => {
    const input = recreateMetaTemplateInputSchema.parse({
      name: "broker_first_access",
      bodyText: "Olá {{nome}}.",
      buttons: [
        { type: "URL", text: "Concluir cadastro", url: "https://ancorahub.com.br/convite/{{1}}" },
        { type: "QUICK_REPLY", text: "Quero saber mais" },
      ],
    });

    expect(buildMetaTemplateComponents(input)[1]).toMatchObject({
      type: "BUTTONS",
      buttons: [
        {
          type: "URL",
          url: "https://crm.ancorasaude.cloud/convite/{{1}}",
          example: ["https://crm.ancorasaude.cloud/convite/token123"],
        },
        { type: "QUICK_REPLY", text: "Quero saber mais" },
      ],
    });
  });
});
