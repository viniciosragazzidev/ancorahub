// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsLiteCooling } from "./leads-lite-cooling";

afterEach(cleanup);

const now = new Date("2026-11-25T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const base = {
  telefone: "21 90000-0000", qualificationStatus: "hot", origem: "manual", sourceCampaign: null, tipo: "PF",
  createdAt: daysAgo(30), assignedAt: null, stageEnteredAt: null, serviceStartedAt: null, firstContactAt: null,
  corretorId: "c1", corretorNome: "Ana Souza", branchId: "b1", branchName: "Centro",
} satisfies Partial<LeadWorkspaceItem>;

const leads: LeadWorkspaceItem[] = [
  { ...base, id: "a", nome: "Risco", status: "quote_sent", lastContactAt: daysAgo(2) },
  { ...base, id: "b", nome: "Voo", status: "negotiation", lastContactAt: daysAgo(10), nextOpenTaskDueAt: new Date(now.getTime() + 36 * 3_600_000).toISOString() },
  { ...base, id: "c", nome: "Esquecido", status: "in_contact", lastContactAt: daysAgo(6), corretorId: null, corretorNome: null },
  { ...base, id: "d", nome: "Recente", status: "in_contact", lastContactAt: daysAgo(0.2) },
];

describe("visão Esfriando", () => {
  it("ordena do mais esquecido, mostra nível com texto e em voo por último", () => {
    render(<LeadsLiteCooling leads={leads} onOpen={vi.fn()} now={now} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain("Esquecido");
    expect(rows[0]!.textContent).toContain("Sem corretor");
    expect(rows[0]!.textContent).toContain("6 dias");
    expect(rows[0]!.textContent).toContain("Crítico");
    expect(rows[1]!.textContent).toContain("Risco");
    expect(rows[1]!.textContent).toContain("Em risco");
    expect(rows[2]!.textContent).toContain("Em voo · Retorno em 2d");
    expect(screen.queryByText("Recente")).toBeNull();
  });

  it("clique na linha abre a gaveta do lead", () => {
    const onOpen = vi.fn();
    render(<LeadsLiteCooling leads={leads} onOpen={onOpen} now={now} />);
    fireEvent.click(screen.getAllByRole("row")[1]!);
    expect(onOpen).toHaveBeenCalledWith(leads[2]);
  });
});
