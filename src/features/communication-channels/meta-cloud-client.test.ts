import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./meta-cloud-config", () => ({
  getMetaCloudServerConfig: () => ({ graphVersion: "v25.0" }),
  getMetaLeadAdsServerConfig: () => ({ accessToken: "platform-token", graphVersion: "v25.0" }),
}));

import { buildMetaCloudTemplatePayload, subscribePageToLeadgen } from "./meta-cloud-client";

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

  it("subscribes an authorized Page to the leadgen event with the platform credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await subscribePageToLeadgen("123456789");

    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v25.0/123456789/subscribed_apps", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer platform-token",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "subscribed_fields=leadgen",
      cache: "no-store",
    });
  });

  it("stops activation when Meta rejects the Page subscription", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Permissão de Página ausente", code: 10 } }), { status: 403 })));

    await expect(subscribePageToLeadgen("123456789")).rejects.toThrow("Permissão de Página ausente");
  });
});
