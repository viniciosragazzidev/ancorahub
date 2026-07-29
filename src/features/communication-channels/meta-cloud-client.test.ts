import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildMetaCloudTemplatePayload } from "./meta-cloud-client";

describe("Meta Cloud template payload", () => {
  it("sends names for the named broker invitation body variables", () => {
    const payload = buildMetaCloudTemplatePayload({
      to: "+55 21 99999-9999",
      templateName: "broker_first_access",
      languageCode: "pt_BR",
      variables: ["Ana", "Ancora", "Gestor"],
      variableNames: ["nome", "empresa", "cargo"],
      urlButtonParameter: "activation-token",
    });

    expect(payload.template.components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "nome", text: "Ana" },
          { type: "text", parameter_name: "empresa", text: "Ancora" },
          { type: "text", parameter_name: "cargo", text: "Gestor" },
        ],
      },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "activation-token" }] },
    ]);
  });

  it("rejects a mismatched named-parameter contract before calling Meta", () => {
    expect(() => buildMetaCloudTemplatePayload({
      to: "+55 21 99999-9999",
      templateName: "broker_first_access",
      languageCode: "pt_BR",
      variables: ["Ana"],
      variableNames: ["nome", "empresa", "cargo"],
    })).toThrow("quantidade de variáveis nomeadas");
  });
});
