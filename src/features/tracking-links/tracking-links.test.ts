import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  findActive: vi.fn(),
  recordClick: vi.fn(),
  findForAttribution: vi.fn(),
  authenticate: vi.fn(),
  createLead: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/tracking-links/service", () => ({
  findActiveLinkByCode: state.findActive,
  recordTrackingLinkClick: state.recordClick,
  findLinkForAttribution: state.findForAttribution,
}));
vi.mock("@/features/leads/webhooks/services/authenticate-lead-webhook", () => ({
  authenticateLeadWebhook: state.authenticate,
  WebhookAuthError: class WebhookAuthError extends Error {},
}));
vi.mock("@/features/leads/webhooks/services/create-lead-from-webhook-sync", () => ({ createLeadFromWebhookSync: state.createLead }));
vi.mock("@/features/lead-distribution/pme-queue-routing", () => ({ resolvePmeQueueFor: vi.fn() }));
vi.mock("@/shared/db", () => ({
  schema: { leadQueues: { id: "id", name: "name", tenantId: "tenant_id", status: "status", createdAt: "created_at" } },
  getDatabase: () => ({ select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [] }) }) }) }),
}));

import { GET } from "@/app/r/[code]/route";
import { receivePublicForm } from "@/features/public-form/intake";
import { parsePublicFormSubmission } from "@/features/public-form/submission-schema";

import {
  attributionMetadata,
  buildRedirectTarget,
  extractLinkRef,
  generateLinkCode,
  LINK_CODE_ALPHABET,
  mergeUtm,
  normalizeLinkCode,
  readFormOrigin,
  validateLinkInput,
  whatsappMessageWithRef,
  type RedirectLink,
} from "./core";

const formLink: RedirectLink = { code: "abc2345", destination: "form", whatsappPhone: null, whatsappMessage: null, utmSource: "instagram", utmMedium: null, utmCampaign: "unimed-nov" };
const waLink: RedirectLink = { ...formLink, code: "wpp7892", destination: "whatsapp", whatsappPhone: "5521998765432", whatsappMessage: "Olá! Quero um plano." };

describe("código do link", () => {
  it("gera 7 caracteres do alfabeto sem letras ambíguas", () => {
    let seed = 0;
    const random = (size: number) => Uint8Array.from({ length: size }, () => (seed = (seed * 31 + 17) % 256));
    for (let i = 0; i < 50; i += 1) {
      const code = generateLinkCode(random);
      expect(code).toHaveLength(7);
      expect([...code].every((char) => LINK_CODE_ALPHABET.includes(char))).toBe(true);
      expect(normalizeLinkCode(code)).toBe(code);
    }
    expect(LINK_CODE_ALPHABET).not.toMatch(/[0o1il]/);
  });

  it("descarta bytes que enviesariam o alfabeto e completa o código", () => {
    // 248..255 ficam acima do maior múltiplo de 31 e são descartados.
    const random = (size: number) => Uint8Array.from({ length: size }, (_, index) => (index % 2 ? 255 : 0));
    expect(generateLinkCode(random)).toBe("aaaaaaa");
  });

  it("aceita maiúsculas e espaços, recusa o resto", () => {
    expect(normalizeLinkCode(" ABC2345 ")).toBe("abc2345");
    expect(normalizeLinkCode("abc234")).toBeNull();
    expect(normalizeLinkCode("abc0345")).toBeNull();
    expect(normalizeLinkCode("../etc")).toBeNull();
    expect(normalizeLinkCode(null)).toBeNull();
  });
});

describe("redirecionamento", () => {
  it("formulário: leva ?lk e preserva as UTMs que chegaram; as do link só completam", () => {
    const target = new URL(buildRedirectTarget(formLink, new URLSearchParams("utm_source=stories&utm_content=video1&fbclid=x"), "https://crm.ancorasaude.cloud"));
    expect(target.origin + target.pathname).toBe("https://crm.ancorasaude.cloud/formulario");
    expect(target.searchParams.get("lk")).toBe("abc2345");
    expect(target.searchParams.get("utm_source")).toBe("stories");
    expect(target.searchParams.get("utm_campaign")).toBe("unimed-nov");
    expect(target.searchParams.get("utm_content")).toBe("video1");
    expect(target.searchParams.has("fbclid")).toBe(false);
  });

  it("WhatsApp: wa.me com a mensagem pronta e o código no fim", () => {
    const target = new URL(buildRedirectTarget(waLink, new URLSearchParams(), "https://crm.ancorasaude.cloud"));
    expect(target.host).toBe("wa.me");
    expect(target.pathname).toBe("/5521998765432");
    expect(target.searchParams.get("text")).toBe("Olá! Quero um plano. (código wpp7892)");
  });

  it("WhatsApp sem número válido cai no formulário", () => {
    const target = new URL(buildRedirectTarget({ ...waLink, whatsappPhone: "123" }, new URLSearchParams(), "https://x.test"));
    expect(target.pathname).toBe("/formulario");
    expect(target.searchParams.get("lk")).toBe("wpp7892");
  });

  it("UTM da URL é limpa de controle e tags", () => {
    expect(mergeUtm(formLink, { utm_source: "ok" })).toEqual({ utm_source: "ok", utm_campaign: "unimed-nov" });
    const target = new URL(buildRedirectTarget(formLink, new URLSearchParams("utm_source=%3Cscript%3Eig"), "https://x.test"));
    expect(target.searchParams.get("utm_source")).toBe("scriptig");
  });
});

describe("rota pública /r/<codigo>", () => {
  beforeEach(() => {
    state.recordClick.mockResolvedValue(undefined);
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
  afterEach(() => vi.clearAllMocks());

  const call = (code: string, query = "", ua = "Mozilla/5.0 (iPhone)") =>
    GET(new NextRequest(`https://crm.ancorasaude.cloud/r/${code}${query}`, { headers: { "User-Agent": ua } }), { params: Promise.resolve({ code }) });

  it("conta o clique e redireciona", async () => {
    state.findActive.mockResolvedValue({ id: "link-1", ...formLink });
    const response = await call("abc2345", "?utm_medium=bio");
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/formulario");
    expect(location.searchParams.get("utm_medium")).toBe("bio");
    expect(state.recordClick).toHaveBeenCalledWith("link-1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("código desconhecido, pausado ou excluído vai para o formulário sem origem nem clique", async () => {
    state.findActive.mockResolvedValue(null);
    const response = await call("zzzzzzz");
    expect(new URL(response.headers.get("location")!).search).toBe("");
    expect(new URL(response.headers.get("location")!).pathname).toBe("/formulario");
    expect(state.recordClick).not.toHaveBeenCalled();
  });

  it("robô de prévia não conta clique, mas é redirecionado", async () => {
    state.findActive.mockResolvedValue({ id: "link-1", ...waLink });
    const response = await call("wpp7892", "", "WhatsApp/2.23.20 A");
    expect(response.headers.get("location")).toContain("wa.me");
    expect(state.recordClick).not.toHaveBeenCalled();
  });

  it("falha do banco nunca segura a pessoa", async () => {
    state.findActive.mockResolvedValue({ id: "link-1", ...formLink });
    state.recordClick.mockRejectedValue(new Error("pool exhausted"));
    const response = await call("abc2345");
    expect(response.status).toBe(302);
    state.findActive.mockRejectedValue(new Error("down"));
    expect((await call("abc2345")).status).toBe(302);
  });
});

describe("atribuição do lead", () => {
  it("o código volta da mensagem do WhatsApp, mesmo com acento ou sem", () => {
    expect(extractLinkRef(whatsappMessageWithRef("Oi", "wpp7892"))).toBe("wpp7892");
    expect(extractLinkRef("quero plano (Codigo WPP7892) obrigado")).toBe("wpp7892");
    expect(extractLinkRef("quero plano")).toBeNull();
    expect(whatsappMessageWithRef(null, "wpp7892")).toBe("(código wpp7892)");
  });

  it("o formulário lê ?lk e as UTMs da URL", () => {
    expect(readFormOrigin("?lk=ABC2345&utm_source=ig&x=1")).toEqual({ link: "abc2345", utm_source: "ig" });
    expect(readFormOrigin("?lk=errado")).toBeUndefined();
  });

  it("metadados do lead: link e UTMs, com as da URL na frente", () => {
    const link = { id: "link-1", code: "abc2345", name: "Instagram bio", utmSource: "instagram", utmMedium: null, utmCampaign: "unimed-nov" };
    expect(attributionMetadata(link, { utm_source: "stories" })).toEqual({
      trackingLinkId: "link-1", trackingLinkCode: "abc2345", trackingLinkName: "Instagram bio", utm_source: "stories", utm_campaign: "unimed-nov",
    });
    expect(attributionMetadata(null, { utm_source: "google" })).toEqual({ utm_source: "google" });
  });

  it("valida o link novo", () => {
    expect(validateLinkInput({ name: "", destination: "form", utmSource: "ig" })).toEqual({ ok: false, error: expect.any(String) });
    expect(validateLinkInput({ name: "Bio", destination: "whatsapp", whatsappPhone: "123", utmSource: "ig" }).ok).toBe(false);
    const ok = validateLinkInput({ name: " Panfleto Unimed ", destination: "whatsapp", whatsappPhone: "(21) 99876-5432", utmSource: "Panfleto Rua", utmCampaign: "Unimed Novembro" });
    expect(ok).toEqual({ ok: true, data: expect.objectContaining({ name: "Panfleto Unimed", whatsappPhone: "5521998765432", utmSource: "panfleto-rua", utmCampaign: "unimed-novembro" }) });
  });

  describe("formulário público", () => {
    const base = {
      kind: "cpf", name: "Maria Souza", people: "30 a 39 anos", ages: null, lives: 1, neighborhood: "Icaraí", city: "Niterói",
      currentPlan: "sem_plano", phone: "21998765432", website: "", idempotencyKey: "chave-abcdef12",
    };
    const meta = { requestId: "req-1", userAgent: null, receivedAt: new Date("2026-11-26T12:00:00Z") };

    beforeEach(() => {
      process.env.FORMULARIO_WEBHOOK_TOKEN = "token";
      state.authenticate.mockResolvedValue({ credentialId: "cred-1", tenantId: "tenant-1", branchId: "branch-1", createdBy: "user-1" });
      state.createLead.mockResolvedValue({ success: true, leadId: "lead-1", duplicate: false });
    });
    afterEach(() => {
      delete process.env.FORMULARIO_WEBHOOK_TOKEN;
      vi.clearAllMocks();
    });

    it("aceita a origem no envio e recusa campos fora da lista", () => {
      expect(parsePublicFormSubmission({ ...base, origin: { link: "abc2345", utm_source: "ig" } }).ok).toBe(true);
      expect(parsePublicFormSubmission({ ...base, origin: { tenantId: "x" } }).ok).toBe(false);
    });

    it("o lead que veio pelo link leva o link e as UTMs, conferido na empresa do formulário", async () => {
      state.findForAttribution.mockResolvedValue({ id: "link-1", code: "abc2345", name: "Instagram bio", utmSource: "instagram", utmMedium: null, utmCampaign: null });
      const parsed = parsePublicFormSubmission({ ...base, origin: { link: "abc2345", utm_content: "video1" } });
      if (!parsed.ok) throw new Error(parsed.error);
      await receivePublicForm(parsed.data, meta);
      expect(state.findForAttribution).toHaveBeenCalledWith("tenant-1", "abc2345");
      expect(state.createLead).toHaveBeenCalledWith(expect.objectContaining({
        leadSource: expect.objectContaining({
          channel: "formulario",
          metadata: expect.objectContaining({ trackingLinkId: "link-1", trackingLinkName: "Instagram bio", utm_source: "instagram", utm_content: "video1" }),
        }),
      }));
    });

    it("link de outra empresa (ou inexistente) não atribui, mas as UTMs ficam", async () => {
      state.findForAttribution.mockResolvedValue(null);
      const parsed = parsePublicFormSubmission({ ...base, origin: { link: "abc2345", utm_source: "google" } });
      if (!parsed.ok) throw new Error(parsed.error);
      await receivePublicForm(parsed.data, meta);
      const metadata = state.createLead.mock.calls[0]![0].leadSource.metadata;
      expect(metadata.trackingLinkId).toBeUndefined();
      expect(metadata.utm_source).toBe("google");
    });
  });
});
