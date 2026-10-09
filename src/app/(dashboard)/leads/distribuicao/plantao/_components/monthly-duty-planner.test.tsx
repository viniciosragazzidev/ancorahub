// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/lead-distribution/monthly-duty-actions", () => ({
  generateMonthlyDutyPlanAction: vi.fn(),
  getMonthlyDutyPlanAction: vi.fn().mockResolvedValue(null),
  publishMonthlyDutyPlanAction: vi.fn(),
  updateMonthlyDutyDraftAction: vi.fn(),
}));
vi.mock("@/features/lead-distribution/duty-type-actions", () => ({
  createDutyTypeAction: vi.fn(),
  updateDutyTypeAction: vi.fn(),
  setDutyTypeArchivedAction: vi.fn(),
}));

import {
  generateMonthlyDutyPlanAction,
  getMonthlyDutyPlanAction,
  publishMonthlyDutyPlanAction,
  updateMonthlyDutyDraftAction,
  type MonthlyDutyPlanView,
} from "@/features/lead-distribution/monthly-duty-actions";
import type { DutyTypeOption } from "./duty-type-ui";
import { MonthlyDutyPlanner, useMonthlyDutyPlans, type PlannerSchedule } from "./monthly-duty-planner";

const PME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRESENCIAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const branches = [{ id: "branch-1", name: "Unidade Centro" }, { id: "branch-2", name: "Unidade Barra" }];
const brokers = [
  { id: "broker-1", name: "Corretor Exemplo", branchId: "branch-1", branchName: "Unidade Centro", internalCode: "C101" },
  { id: "broker-2", name: "Segunda Pessoa", branchId: "branch-2", branchName: "Unidade Barra", internalCode: "C202" },
];
const type = (id: string, name: string, attendanceMode: "online" | "presencial", branchIds: string[] = []): DutyTypeOption => ({
  id, name, status: "active", attendanceMode, colorHue: 208, branchIds,
  defaultStartsAt: "09:00", defaultEndsAt: "19:00", defaultMinimumBrokers: 1, defaultMaximumBrokers: null,
});
// PME takes part only in Unidade Centro.
const types = [type(PME, "PME", "online", ["branch-1"]), type(PRESENCIAL, "Presencial", "presencial")];
const schedule = (id: string, name: string, typeId: string, dayOfWeek: number, attendanceMode = "online"): PlannerSchedule => ({
  id, name, branchId: null, dayOfWeek, startsAt: "09:00", endsAt: "13:30", minimumBrokers: 1, maximumBrokers: null,
  timezone: "America/Sao_Paulo", validFrom: new Date("2026-11-01T03:00:00Z"), validUntil: null, status: "active",
  typeId, attendanceMode, typeBranchIds: types.find((item) => item.id === typeId)!.branchIds,
});
const schedules = [
  schedule("11111111-1111-4111-8111-111111111111", "PME · Manhã", PME, 1),
  schedule("22222222-2222-4222-8222-222222222222", "Presencial", PRESENCIAL, 3, "presencial"),
];

const draft: MonthlyDutyPlanView = {
  id: "33333333-3333-4333-8333-333333333333",
  monthKey: "2026-12",
  revision: 1,
  status: "draft",
  publishedAt: null,
  rangeFrom: "2026-12-01",
  rangeUntil: "2026-12-31",
  settings: { rangeFrom: "2026-12-01", rangeUntil: "2026-12-31", typeKeys: [PME], brokers: [{ brokerId: "broker-1", modality: "any", seats: { [PME]: 2 }, forcedTypeKeys: [] }] },
  quotas: [{ brokerId: "broker-1", quota: 2, assigned: 1 }],
  brokerSeats: {},
  brokers: [{ id: "broker-1", name: "Corretor Exemplo", code: "C101", branchId: "branch-1", branchName: "Unidade Centro" }],
  occurrences: [{
    id: "11111111-1111-4111-8111-111111111111:2026-12-07", scheduleId: "11111111-1111-4111-8111-111111111111", scheduleName: "PME · Manhã", dutyDate: "2026-12-07", startsAt: "09:00", endsAt: "13:30",
    minimumBrokers: 2, maximumBrokers: 3, allowedBrokerIds: ["broker-1"], typeId: PME, attendanceMode: "online",
    brokers: [{ id: "broker-1", name: "Corretor Exemplo", code: "C101", branchId: "branch-1", branchName: "Unidade Centro", forced: false }],
    assignedCount: 1, ended: false,
  }],
  totalAssigned: 1,
  belowMinimum: 1,
  missingQuota: 1,
  problems: [],
  warnings: [],
  canEdit: true,
  replacesPublished: false,
};

function Harness({ enabled = true, canEdit = true, onCreate = vi.fn() }: { enabled?: boolean; canEdit?: boolean; onCreate?: () => void }) {
  const [open, setOpen] = useState(true);
  const plansState = useMonthlyDutyPlans(enabled);
  return (
    <MonthlyDutyPlanner
      brokers={brokers}
      branches={branches}
      types={types}
      enabled={enabled}
      canEdit={canEdit}
      month="2026-12"
      open={open}
      onOpenChange={setOpen}
      schedules={schedules}
      plansState={plansState}
      onCreateSchedule={onCreate}
    />
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(null); });

async function chooseTypeAndContinue(name: string) {
  fireEvent.click(await screen.findByLabelText(`Incluir ${name}`));
  fireEvent.click(screen.getByRole("button", { name: "Continuar para corretores" }));
}

function searchAndAdd(text: string, name: string) {
  fireEvent.change(screen.getByPlaceholderText("Buscar corretor por nome ou código"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: `Adicionar ${name}` }));
}

describe("monthly duty planner", () => {
  it("starts with the period and the plantão types, not the queues", async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);
    expect(await screen.findByLabelText("Incluir PME")).toBeTruthy();
    expect(screen.getByLabelText("Incluir Presencial")).toBeTruthy();
    expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-12-01");
    expect((screen.getByLabelText("Até") as HTMLInputElement).value).toBe("2026-12-31");
    expect((screen.getByRole("button", { name: "Continuar para corretores" }) as HTMLButtonElement).disabled).toBe(true);

    // The period may run into the next month.
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2027-01-05" } });
    expect(screen.getByText(/36 dias/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo plantão/ }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("adds qualified brokers by search, keeps seats pending until set and generates per type", async () => {
    vi.mocked(generateMonthlyDutyPlanAction).mockResolvedValue(draft);
    render(<Harness />);
    await chooseTypeAndContinue("PME");

    expect(screen.queryByText("Corretor Exemplo")).toBeNull();
    searchAndAdd("C101", "Corretor Exemplo");
    expect(await screen.findByText("Cadeiras pendentes")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aumentar cadeiras de Corretor Exemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar cadeiras de Corretor Exemplo" }));
    expect(screen.queryByText("Cadeiras pendentes")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Gerar proposta/ }));
    await waitFor(() => expect(generateMonthlyDutyPlanAction).toHaveBeenCalledWith({
      monthKey: "2026-12",
      rangeFrom: "2026-12-01",
      rangeUntil: "2026-12-31",
      typeKeys: [PME],
      brokers: [{ brokerId: "broker-1", modality: "any", seats: { [PME]: 2 }, forcedTypeKeys: [] }],
    }));
    expect(await screen.findByText("1/2 mín. · máx. 3")).toBeTruthy();
  });

  it("asks before qualifying a broker whose unit is outside the type", async () => {
    vi.mocked(generateMonthlyDutyPlanAction).mockResolvedValue(draft);
    render(<Harness />);
    await chooseTypeAndContinue("PME");

    searchAndAdd("Segunda", "Segunda Pessoa");
    expect(await screen.findByText("Adicionar Segunda Pessoa mesmo assim?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mesmo assim" }));
    expect(await screen.findByText(/fora da unidade \(confirmado\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aumentar cadeiras de Segunda Pessoa" }));
    fireEvent.click(screen.getByRole("button", { name: /Gerar proposta/ }));
    await waitFor(() => expect(generateMonthlyDutyPlanAction).toHaveBeenCalledWith(expect.objectContaining({
      brokers: [{ brokerId: "broker-2", modality: "any", seats: { [PME]: 1 }, forcedTypeKeys: [PME] }],
    })));
  });

  it("sets modality and seats per type in the broker dialog and removes a broker", async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByLabelText("Incluir PME"));
    fireEvent.click(screen.getByLabelText("Incluir Presencial"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar para corretores" }));

    searchAndAdd("Corretor", "Corretor Exemplo");
    fireEvent.click(await screen.findByRole("button", { name: "Configurar Corretor Exemplo" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Presencial" }));
    expect(await screen.findByText(/com a modalidade escolhida ele não entra neles/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar cadeiras de Presencial" }));
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    expect(await screen.findByText("· só presencial")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover Corretor Exemplo da escala" }));
    expect(screen.queryByRole("button", { name: "Configurar Corretor Exemplo" })).toBeNull();
  });

  it("keeps a date that already passed read-only in an old draft", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue({ ...draft, occurrences: [{ ...draft.occurrences[0], ended: true }] });
    render(<Harness />);
    expect(await screen.findByText("Já passou · não será publicado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remover Corretor Exemplo/ })).toBeNull();
  });

  it("explains it is disabled without loading anything", async () => {
    render(<Harness enabled={false} />);
    expect(await screen.findByText("Escala mensal indisponível")).toBeTruthy();
    expect(getMonthlyDutyPlanAction).not.toHaveBeenCalled();
  });

  it("removes a broker from a draft occurrence", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(draft);
    vi.mocked(updateMonthlyDutyDraftAction).mockResolvedValue({ ...draft, occurrences: [{ ...draft.occurrences[0], brokers: [], assignedCount: 0 }], totalAssigned: 0 });
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: /Remover Corretor Exemplo de PME · Manhã/ }));
    await waitFor(() => expect(updateMonthlyDutyDraftAction).toHaveBeenCalledWith({ planId: draft.id, occurrenceId: draft.occurrences[0].id, brokerId: "broker-1", operation: "remove", force: false }));
    expect(await screen.findByText("Ninguém escalado")).toBeTruthy();
  });

  it("asks for confirmation before publishing", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(draft);
    vi.mocked(publishMonthlyDutyPlanAction).mockResolvedValue({ ...draft, status: "published", publishedAt: "2026-11-30T12:00:00.000Z" });
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Publicar escala" }));
    expect(publishMonthlyDutyPlanAction).not.toHaveBeenCalled();
    const buttons = await screen.findAllByRole("button", { name: "Publicar escala" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(publishMonthlyDutyPlanAction).toHaveBeenCalledWith(draft.id));
    expect(await screen.findByText(/Para mudar, gere uma nova/)).toBeTruthy();
  });

  it("offers the escala PDF and a per-broker view", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(draft);
    render(<Harness />);
    fireEvent.click(await screen.findByRole("tab", { name: "Por corretor" }));
    expect(await screen.findByText("1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gerar PDF/ }));
    expect(await screen.findByText("Gerar PDF da escala")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Por unidade" })).toBeTruthy();
  });

  it("shows Managers the review only, without editing controls", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue({ ...draft, canEdit: false });
    render(<Harness canEdit={false} />);

    expect(await screen.findByText("PME · Manhã")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publicar escala" })).toBeNull();
  });
});
