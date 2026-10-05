// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/lead-distribution/monthly-duty-actions", () => ({
  generateMonthlyDutyPlanAction: vi.fn(),
  getMonthlyDutyPlanAction: vi.fn().mockResolvedValue(null),
  publishMonthlyDutyPlanAction: vi.fn(),
  updateMonthlyDutyDraftAction: vi.fn(),
}));

import {
  generateMonthlyDutyPlanAction,
  getMonthlyDutyPlanAction,
  publishMonthlyDutyPlanAction,
  updateMonthlyDutyDraftAction,
  type MonthlyDutyPlanView,
} from "@/features/lead-distribution/monthly-duty-actions";
import { MonthlyDutyPlanner, useMonthlyDutyPlans, type MonthSchedule } from "./monthly-duty-planner";

const brokers = [
  { id: "broker-1", name: "Corretor Exemplo", branchId: "branch-1", branchName: "Unidade Centro" },
  { id: "broker-2", name: "Segunda Pessoa", branchId: "branch-1", branchName: "Unidade Centro" },
];

const schedules: MonthSchedule[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Plantão Presencial", dayOfWeek: 1, startsAt: "13:30", endsAt: "18:00", minimumBrokers: 1, maximumBrokers: null, dates: 4, outside: null },
  { id: "22222222-2222-4222-8222-222222222222", name: "PLANTÃO PME", dayOfWeek: 2, startsAt: "09:00", endsAt: "18:00", minimumBrokers: 1, maximumBrokers: null, dates: 0, outside: { reason: "ends_before", label: "Terminou em 21/11/2026" } },
];

const draft: MonthlyDutyPlanView = {
  id: "33333333-3333-4333-8333-333333333333",
  monthKey: "2026-12",
  revision: 1,
  status: "draft",
  publishedAt: null,
  quotas: [{ brokerId: "broker-1", quota: 2, assigned: 1 }, { brokerId: "broker-2", quota: 0, assigned: 0 }],
  occurrences: [{
    id: "sat:2026-12-07", scheduleId: schedules[0].id, scheduleName: "Plantão Presencial", dutyDate: "2026-12-07", startsAt: "13:30", endsAt: "18:00",
    minimumBrokers: 2, maximumBrokers: 3, allowedBrokerIds: ["broker-1", "broker-2"],
    brokers: [{ id: "broker-1", name: "Corretor Exemplo" }], assignedCount: 1, ended: false,
  }],
  totalAssigned: 1,
  belowMinimum: 1,
  missingQuota: 1,
  problems: [],
  warnings: [],
  canEdit: true,
  replacesPublished: false,
};

function Harness({ enabled = true, canEdit = true, onExtend = vi.fn().mockResolvedValue(true), onCreate = vi.fn(), monthSchedules = schedules }: { enabled?: boolean; canEdit?: boolean; onExtend?: (id: string) => Promise<boolean>; onCreate?: () => void; monthSchedules?: MonthSchedule[] }) {
  const [open, setOpen] = useState(true);
  const plansState = useMonthlyDutyPlans(enabled);
  return (
    <MonthlyDutyPlanner
      brokers={brokers}
      enabled={enabled}
      canEdit={canEdit}
      month="2026-12"
      open={open}
      onOpenChange={setOpen}
      schedules={monthSchedules}
      plansState={plansState}
      onCreateSchedule={onCreate}
      onExtendSchedule={onExtend}
    />
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(null); });

const byQueue: MonthSchedule[] = [
  { ...schedules[0], id: "44444444-4444-4444-8444-444444444444", name: "Plantão PF", queueId: "q-pf", queueName: "Fila PF", dates: 4 },
  { ...schedules[0], id: "55555555-5555-4555-8555-555555555555", name: "PME 28/12", queueId: "q-pme", queueName: "Fila PME", dates: 1, dayOfWeek: 1 },
  { ...schedules[0], id: "66666666-6666-4666-8666-666666666666", name: "PME 29/12", queueId: "q-pme", queueName: "Fila PME", dates: 1, dayOfWeek: 2 },
  { ...schedules[0], id: "77777777-7777-4777-8777-777777777777", name: "PME 02/12", queueId: "q-pme", queueName: "Fila PME", dates: 0, finished: true },
];

describe("monthly duty planner", () => {
  it("staffs only one queue in one click and leaves finished plantões out", async () => {
    vi.mocked(generateMonthlyDutyPlanAction).mockResolvedValue(draft);
    render(<Harness monthSchedules={byQueue} />);

    const pme = await screen.findByRole("button", { name: "Fila PME · 2" });
    expect(screen.getByRole("button", { name: "Todas · 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("checkbox", { name: /PME 02\/12/ })).toBeNull();
    expect(screen.getByText(/1 plantão já terminou neste mês e não entra na escala: PME 02\/12/)).toBeTruthy();

    fireEvent.click(pme);
    expect(pme.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("checkbox", { name: /Incluir Plantão PF/ }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Continuar para cotas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    fireEvent.click(await screen.findByRole("button", { name: /Gerar proposta/ }));
    await waitFor(() => expect(generateMonthlyDutyPlanAction).toHaveBeenCalledWith(expect.objectContaining({
      scheduleIds: [byQueue[1].id, byQueue[2].id],
    })));
  });

  it("staffs a published month again from the plantões step", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue({ ...draft, status: "published", publishedAt: "2026-11-30T12:00:00.000Z" });
    vi.mocked(generateMonthlyDutyPlanAction).mockResolvedValue({ ...draft, revision: 2, replacesPublished: true });
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: /Gerar nova escala/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar para cotas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    fireEvent.click(await screen.findByRole("button", { name: /Gerar proposta|Gerar nova proposta/ }));
    await waitFor(() => expect(generateMonthlyDutyPlanAction).toHaveBeenCalled());
    expect(await screen.findByText(/substitui a publicada nas datas que ainda não passaram/)).toBeTruthy();
  });

  it("keeps a date that already passed read-only in an old draft", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue({ ...draft, occurrences: [{ ...draft.occurrences[0], ended: true }] });
    render(<Harness />);
    expect(await screen.findByText("Já passou · não será publicado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remover Corretor Exemplo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Adicionar/ })).toBeNull();
  });

  it("explains it is disabled without loading anything", async () => {
    render(<Harness enabled={false} />);
    expect(await screen.findByText("Escala mensal indisponível")).toBeTruthy();
    expect(getMonthlyDutyPlanAction).not.toHaveBeenCalled();
  });

  it("starts by choosing the month's plantões, explaining the ones outside it", async () => {
    const onExtend = vi.fn().mockResolvedValue(true);
    const onCreate = vi.fn();
    render(<Harness onExtend={onExtend} onCreate={onCreate} />);

    expect(await screen.findByRole("checkbox", { name: /Incluir Plantão Presencial/ })).toBeTruthy();
    expect(screen.getByText("1 plantão não acontece em Dezembro de 2026")).toBeTruthy();
    expect(screen.getByText("Terminou em 21/11/2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Estender até o fim do mês" }));
    await waitFor(() => expect(onExtend).toHaveBeenCalledWith(schedules[1].id));
    fireEvent.click(screen.getByRole("button", { name: /Novo plantão/ }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("goes plantões → cotas → gerar with only the chosen plantões", async () => {
    vi.mocked(generateMonthlyDutyPlanAction).mockResolvedValue(draft);
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Continuar para cotas" }));
    fireEvent.change(screen.getByLabelText("Mesma cota para todos"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => {
      expect((screen.getByRole("spinbutton", { name: "Cota mensal de Segunda Pessoa" }) as HTMLInputElement).value).toBe("3");
    });
    fireEvent.click(screen.getByRole("button", { name: /Gerar proposta/ }));
    await waitFor(() => expect(generateMonthlyDutyPlanAction).toHaveBeenCalledWith({
      monthKey: "2026-12",
      quotas: [{ brokerId: "broker-1", quota: 3 }, { brokerId: "broker-2", quota: 3 }],
      scheduleIds: [schedules[0].id],
    }));
    expect(await screen.findByText("1/2 mín. · máx. 3")).toBeTruthy();
  });

  it("edits and publishes a draft after confirmation", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue(draft);
    vi.mocked(updateMonthlyDutyDraftAction).mockResolvedValue({ ...draft, occurrences: [{ ...draft.occurrences[0], brokers: [], assignedCount: 0 }], totalAssigned: 0 });
    vi.mocked(publishMonthlyDutyPlanAction).mockResolvedValue({ ...draft, status: "published", publishedAt: "2026-11-30T12:00:00.000Z" });
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: /Remover Corretor Exemplo de Plantão Presencial/ }));
    await waitFor(() => expect(updateMonthlyDutyDraftAction).toHaveBeenCalledWith({ planId: draft.id, occurrenceId: "sat:2026-12-07", brokerId: "broker-1", operation: "remove" }));
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
    expect(await screen.findByText(/Para mudar, gere uma nova escala/)).toBeTruthy();
  });

  it("shows Managers the review only, without editing controls", async () => {
    vi.mocked(getMonthlyDutyPlanAction).mockResolvedValue({ ...draft, canEdit: false });
    render(<Harness canEdit={false} />);

    expect(await screen.findByText("Plantão Presencial")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publicar escala" })).toBeNull();
  });
});
