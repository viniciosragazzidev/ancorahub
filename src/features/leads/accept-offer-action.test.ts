import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lead: null as null | { corretorId: string; assignmentSource: string; nome: string; telefone: string; status: string },
  startLeadServiceAction: vi.fn(async (_prev: unknown, _form: FormData): Promise<{ success?: boolean; error?: string; whatsappUrl?: string }> => ({ success: true, whatsappUrl: "https://wa.me/5561999999999" })),
  handleLeadOfferWebhookResponse: vi.fn(async () => ({ processed: false, reason: "no_offer" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ tenantId: "t1", userId: "broker-1", role: "broker", branchId: "b1" }),
}));
vi.mock("@/shared/db", () => ({
  schema: { leads: { id: "id", tenantId: "tenantId", corretorId: "corretorId", assignmentSource: "assignmentSource", nome: "nome", telefone: "telefone", status: "status" } },
  getDatabase: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (mocks.lead ? [mocks.lead] : []) }) }) }),
  }),
}));
vi.mock("@/features/lead-distribution/offers", () => ({ handleLeadOfferWebhookResponse: mocks.handleLeadOfferWebhookResponse }));
vi.mock("@/app/(dashboard)/leads/[id]/service-action", () => ({ startLeadServiceAction: mocks.startLeadServiceAction }));
vi.mock("./broker-greeting-server", () => ({ loadBrokerGreetingSafe: async () => "Olá" }));
vi.mock("@/lib/whatsapp-url", () => ({ buildWhatsAppUrl: () => "https://wa.me/5561999999999" }));

import { acceptLeadOfferAction } from "./accept-offer-action";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";

describe("aceite pela conversa em lead sem oferta (transferência, piloto 03/11)", () => {
  beforeEach(() => {
    mocks.startLeadServiceAction.mockClear();
  });

  it("lead do próprio corretor ainda distribuído: inicia o atendimento pelo mesmo serviço do CRM", async () => {
    mocks.lead = { corretorId: "broker-1", assignmentSource: "post_sale_transfer", nome: "Maria", telefone: "5561999999999", status: "distributed" };
    const result = await acceptLeadOfferAction(LEAD_ID);
    expect(mocks.startLeadServiceAction).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it("lead já em atendimento: não reinicia", async () => {
    mocks.lead = { corretorId: "broker-1", assignmentSource: "post_sale_transfer", nome: "Maria", telefone: "5561999999999", status: "in_contact" };
    const result = await acceptLeadOfferAction(LEAD_ID);
    expect(mocks.startLeadServiceAction).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("se o início falhar, o aceite não é reportado como feito", async () => {
    mocks.lead = { corretorId: "broker-1", assignmentSource: "post_sale_transfer", nome: "Maria", telefone: "5561999999999", status: "distributed" };
    mocks.startLeadServiceAction.mockResolvedValueOnce({ success: false, error: "Este lead já foi assumido ou não está mais disponível." });
    const result = await acceptLeadOfferAction(LEAD_ID);
    expect(result.success).toBe(false);
  });
});
