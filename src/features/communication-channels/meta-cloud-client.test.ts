import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./meta-cloud-config", () => ({
  getMetaCloudServerConfig: () => ({ graphVersion: "v25.0" }),
  getMetaLeadAdsServerConfig: () => ({ accessToken: "platform-token", graphVersion: "v25.0" }),
}));

import { buildMetaCloudTemplatePayload, discoverMetaLeadAdsAssets, formatE164Phone, registerMetaPhoneNumber, resolvePageAccessToken, sendMetaCloudTemplate, subscribePageToLeadgen } from "./meta-cloud-client";

describe("formatE164Phone", () => {
  it("formats Brazilian numbers for DDD >= 31 removing 9th digit (e.g., DDD 41)", () => {
    expect(formatE164Phone("+55 41 92002-2871")).toBe("554120022871");
    expect(formatE164Phone("5541920022871")).toBe("554120022871");
    expect(formatE164Phone("41920022871")).toBe("554120022871");
    expect(formatE164Phone("4120022871")).toBe("554120022871");
  });

  it("formats Brazilian numbers for DDD <= 28 keeping or adding 9th digit (e.g., DDD 11)", () => {
    expect(formatE164Phone("+55 11 98765-4321")).toBe("5511987654321");
    expect(formatE164Phone("551187654321")).toBe("5511987654321");
    expect(formatE164Phone("11987654321")).toBe("5511987654321");
  });

  it("preserves international phone numbers", () => {
    expect(formatE164Phone("+1 (415) 555-2671")).toBe("14155552671");
  });
});

describe("Meta Cloud template payload", () => {
  it("registers the selected phone server-side without exposing the two-step PIN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(registerMetaPhoneNumber("123456789", "channel-token", "012345")).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v25.0/123456789/register", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer channel-token", "Content-Type": "application/json" }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ messaging_product: "whatsapp", pin: "012345" });
  });

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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "780859815090303", subscribed_fields: ["leadgen"] }] }), { status: 200 }));
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

  it("does not claim success when Meta accepts the request but omits leadgen from the verified subscription", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "another-app", subscribed_fields: ["leadgen"] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(subscribePageToLeadgen("123456789", "page-token")).rejects.toThrow("leadgen subscription");
  });

  it("sends an approved service template only through the configured official number", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMetaCloudTemplate({
      phoneNumberId: "phone-number-id",
      accessToken: "channel-token",
      to: "+55 21 99999-9999",
      templateName: "broker_first_access",
      languageCode: "pt_BR",
      variables: ["Ana", "Ancora", "Gestor"],
      variableNames: ["nome", "empresa", "cargo"],
    })).resolves.toEqual({ messages: [{ id: "wamid.test" }] });

    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v25.0/phone-number-id/messages", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: expect.objectContaining({ Authorization: "Bearer channel-token", "Content-Type": "application/json" }),
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5521999999999",
      type: "template",
      template: { name: "broker_first_access", language: { code: "pt_BR" } },
    });
  });

  it("derives a Page token from the connecting user's assets and returns only the selected Page token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "other-page", access_token: "other-page-token" },
        { id: "123456789", access_token: "selected-page-token" },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolvePageAccessToken("123456789", "user-token")).resolves.toBe("selected-page-token");
    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v25.0/me/accounts?fields=id,access_token&limit=100", {
      headers: { Accept: "application/json", Authorization: "Bearer user-token" },
      cache: "no-store",
    });
  });

  it("does not fall back to another Page token when the selected Page is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "other-page", access_token: "other-page-token" }],
    }), { status: 200 })));

    await expect(resolvePageAccessToken("123456789", "user-token")).rejects.toThrow("não devolveu um token para a Página selecionada");
  });

  it("uses only the selected Page when retrying a Lead Ads subscription", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Token da Página necessário", code: 210 } }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "page-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "780859815090303", subscribed_fields: ["leadgen"] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(subscribePageToLeadgen("123456789")).resolves.toEqual({ success: true, verified: true });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://graph.facebook.com/v25.0/123456789/subscribed_apps",
      "https://graph.facebook.com/v25.0/123456789?fields=access_token",
      "https://graph.facebook.com/v25.0/123456789/subscribed_apps",
      "https://graph.facebook.com/v25.0/123456789/subscribed_apps?fields=id,subscribed_fields",
    ]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("me/accounts"))).toBe(false);
  });

  it("validates only the requested Page instead of listing assets from every tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123456789", name: "Página do tenant atual" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverMetaLeadAdsAssets("123456789")).resolves.toEqual({
      pages: [{ id: "123456789", name: "Página do tenant atual" }],
      adAccounts: [],
      pixels: [],
      datasets: [],
    });
    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v25.0/123456789?fields=id,name", {
      headers: { Accept: "application/json", Authorization: "Bearer platform-token" },
      cache: "no-store",
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("me/accounts"))).toBe(false);
  });
});
