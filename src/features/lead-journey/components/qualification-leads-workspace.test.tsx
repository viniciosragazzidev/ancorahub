// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/qualificacao/leads", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => vi.fn(() => ({ motion: false, celebrate: false })) }));
vi.mock("../actions", () => ({
  getLeadTimelineAction: vi.fn(), markBadMomentAction: vi.fn(), markDoNotContactAction: vi.fn(), sendToCallQueueAction: vi.fn(),
  getRecoveryPositionAction: vi.fn(), changeRecoveryAction: vi.fn(),
}));

import { describeRecoveryPosition } from "@/features/lead-recovery/position-core";

import { buildQualificationRow } from "../rows";

const lab = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/dev-lab", () => ({ useDevLab: () => lab.value }));

import { QualificationLeadsWorkspace } from "./qualification-leads-workspace";

const NOW = new Date();
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function stoppedLead() {
  return buildQualificationRow({
    id: "lead-1", nome: "Marina Souza", telefone: "5521999990000", status: "new", qualification_status: "qualifying", corretor_id: null, assigned_at: null, first_contact_at: null,
    distribution_status: "unassigned", created_at: ago(10), source_channel: "meta_lead_ads", lives_count: null, queue_id: "q1", queue_name: "Plantão Rio", broker_name: null,
    turbo: null, recovery: null, opt_out_at: null, wrong_number_at: null, collected_fields: ["planType"], inbound_count: 2, last_inbound_at: ago(6), last_ai_at: ago(5), first_ai_at: ago(9), silence_sent: false,
  }, NOW);
}

function services(overrides: Record<string, unknown> = {}) {
  const active = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: ago(5), recovery: null, running: true, touches: [{ step: "s2", status: "sent", at: ago(2) }] });
  const paused = describeRecoveryPosition({ now: NOW, segment: "stopped_midway", startAt: ago(5), recovery: { state: "paused" }, running: true, touches: [] });
  return {
    timeline: vi.fn(async () => ({ ok: true as const, data: { items: [] } })),
    doNotContact: vi.fn(), toCallQueue: vi.fn(), badMoment: vi.fn(),
    recoveryPosition: vi.fn(async () => ({ ok: true as const, data: { position: active } })),
    changeRecovery: vi.fn(async () => ({ ok: true as const, data: { position: paused } })),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  lab.value = null;
});

async function openDrawer() {
  render(<QualificationLeadsWorkspace rows={[stoppedLead()]} nowIso={NOW.toISOString()} />);
  await act(async () => {
    fireEvent.click(screen.getAllByText("Marina Souza")[0]);
  });
}

describe("gaveta do lead: onde está agora", () => {
  it("mostra o passo atual e o próximo toque da recuperação", async () => {
    lab.value = { qualificationLeads: services() };
    await openDrawer();
    expect(await screen.findByText("Passo 2 de 5")).toBeInTheDocument();
    expect(screen.getByText(/Último passo: Retomada depois de 3 horas/)).toBeInTheDocument();
    expect(screen.getByText(/Próximo toque: Oferta de simulação no dia seguinte/)).toBeInTheDocument();
  });

  it("pausar confirma só depois do servidor e troca o menu para Retomar", async () => {
    const svc = services();
    lab.value = { qualificationLeads: svc };
    await openDrawer();
    await screen.findByText("Passo 2 de 5");
    fireEvent.click(screen.getByRole("button", { name: "Ações da recuperação" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Pausar recuperação" }));
    });
    expect(svc.changeRecovery).toHaveBeenCalledWith("lead-1", "pause");
    expect(await screen.findByText("Recuperação pausada. Nenhum toque sai até retomar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ações da recuperação" }));
    expect(screen.getByRole("menuitem", { name: "Retomar recuperação" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pular passo" })).not.toBeInTheDocument();
  });

  it("encerrar pede confirmação antes de chamar o servidor", async () => {
    const svc = services();
    lab.value = { qualificationLeads: svc };
    await openDrawer();
    await screen.findByText("Passo 2 de 5");
    fireEvent.click(screen.getByRole("button", { name: "Ações da recuperação" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Encerrar recuperação" }));
    expect(svc.changeRecovery).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Encerrar recuperação" }));
    });
    expect(svc.changeRecovery).toHaveBeenCalledWith("lead-1", "finish");
  });

  it("falha ao pular mostra a causa, o que continua valendo e Tentar de novo", async () => {
    const svc = services({ changeRecovery: vi.fn(async () => ({ ok: false as const, error: "Não há passo para pular agora." })) });
    lab.value = { qualificationLeads: svc };
    await openDrawer();
    await screen.findByText("Passo 2 de 5");
    fireEvent.click(screen.getByRole("button", { name: "Ações da recuperação" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Pular passo" }));
    });
    expect(await screen.findByText(/Não há passo para pular agora/)).toBeInTheDocument();
    expect(screen.getByText(/A recuperação continua como estava/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
