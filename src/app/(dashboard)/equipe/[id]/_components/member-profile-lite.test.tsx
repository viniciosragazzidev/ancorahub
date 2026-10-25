// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/supervisor-workspace/broker-profile/supervisor-broker-profile", () => ({ SupervisorNoteHistory: () => <p>Histórico</p> }));

import { MEMBER_PROFILE_FIXTURE } from "./member-profile-fixtures";
import { MemberProfileLite, inPeriod } from "./member-profile-lite";

afterEach(cleanup);

const NOW = "2026-10-25T01:30:00.000Z";

function renderProfile(overrides: Partial<Parameters<typeof MemberProfileLite>[0]> = {}) {
  return render(<MemberProfileLite profile={MEMBER_PROFILE_FIXTURE} leadsLimit={200} notes={[]} showFeedbacks={false} ranking={null} scopeNote={false} now={NOW} {...overrides} />);
}

describe("MemberProfileLite", () => {
  it("identidade, números e o link de volta à equipe", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: "Maximiliano Cavalcanti Rocha" })).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByText("COR-0142")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar à equipe/ })).toHaveAttribute("href", "/equipe");
    expect(screen.getByText("96% com 1º contato")).toBeInTheDocument();
  });

  it("leads por período e temperatura, com link real para o lead", () => {
    renderProfile();
    const table = () => document.querySelectorAll('[data-lite="table"]')[0] as HTMLElement;
    const sevenDays = table().querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByRole("button", { name: /^Todos/ }));
    expect(table().querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(sevenDays);
    fireEvent.click(screen.getByRole("button", { name: /^Quentes/ }));
    for (const row of table().querySelectorAll("tbody tr")) expect(within(row as HTMLElement).getByText("Quente")).toBeInTheDocument();
    expect(within(table()).getAllByRole("link")[0]).toHaveAttribute("href", expect.stringMatching(/^\/leads\//));
  });

  it("período de hoje usa o dia de Brasília (22:30 BRT ainda é dia 24)", () => {
    const now = new Date(NOW);
    expect(inPeriod({ assignedAt: new Date("2026-10-24T13:00:00.000Z"), createdAt: new Date("2026-10-24T13:00:00.000Z") }, "today", now)).toBe(true);
    expect(inPeriod({ assignedAt: new Date("2026-10-24T02:00:00.000Z"), createdAt: new Date("2026-10-24T02:00:00.000Z") }, "today", now)).toBe(false);
  });

  it("feedbacks só quando o servidor libera; aviso de escopo do gestor", () => {
    renderProfile({ showFeedbacks: false, scopeNote: true });
    expect(screen.queryByRole("heading", { name: "Feedbacks" })).not.toBeInTheDocument();
    expect(screen.getByText("Você está vendo apenas dados e leads da sua unidade.")).toBeInTheDocument();
  });
});
