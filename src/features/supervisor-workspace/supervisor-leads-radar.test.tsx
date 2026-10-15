// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/arc/button/button", () => ({ Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button> }));
vi.mock("@/components/arc/search-field/search-field", () => ({ SearchField: ({ value, onValueChange, label }: { value: string; onValueChange: (value: string) => void; label: string }) => <label>{label}<input value={value} onChange={(event) => onValueChange(event.target.value)} /></label> }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: ({ label, options, value, onValueChange }: { label: string; options: Array<{ value: string; label: string }>; value: string; onValueChange: (value: string) => void }) => <div role="group" aria-label={label}>{options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div> }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name, className }: { name: string; className?: string }) => <span className={className} role="img" aria-label={name}>{name}</span> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description }: { title: string; description: string }) => <section><strong>{title}</strong><p>{description}</p></section> }));

import { classifyRadarLead, leadAlerts, SupervisorLeadsRadar, type RadarLead } from "./supervisor-leads-radar";

const now = "2026-10-10T10:30:00.000Z";
const late: RadarLead = { id: "lead-1", name: "Maria Silva", phone: "11999990000", status: "distributed", ownerId: "broker-1", ownerName: "Ana Souza", ownerImage: null, productName: "PME", assignedAt: "2026-10-10T10:00:00.000Z", firstContactAt: null, stageEnteredAt: null, tags: [{ id: "t1", name: "Indicação", colorHue: 140 }] };
const calm: RadarLead = { ...late, id: "lead-2", name: "João Lima", ownerId: "broker-2", ownerName: "Paulo Dias", status: "in_contact", firstContactAt: "2026-10-10T10:05:00.000Z", stageEnteredAt: "2026-10-10T10:05:00.000Z", tags: [] };
const team = [
  { id: "broker-1", name: "Ana Souza", image: null, availability: "available", openCount: 1, late: 1 },
  { id: "broker-2", name: "Paulo Dias", image: null, availability: "available", openCount: 1, late: 0 },
];
const data = { team, leads: [late, calm], funnel: { new: 1, firstContact: 0, service: 1, quote: 0, closing: 0 }, slaMinutes: 15 };

afterEach(() => cleanup());

describe("SupervisorLeadsRadar", () => {
  it("classifies SLA and waiting groups from live timestamps", () => {
    expect(classifyRadarLead(late, new Date(now), 15)).toBe("late");
    expect(classifyRadarLead({ ...late, assignedAt: "2026-10-10T10:29:00.000Z" }, new Date(now), 15)).toBe("waiting");
  });

  it("lists every alert of a lead, the late first contact first", () => {
    const alerts = leadAlerts({ ...late, clientWaitingSince: "2026-10-10T10:20:00.000Z", overdueTasks: 2 }, "late", new Date(now));
    expect(alerts.map((alert) => alert.chip)).toEqual(["Atrasado", "Cliente esperando", "Tarefa vencida"]);
    expect(alerts[0]!.text).toBe("Sem primeiro contato há 30 min");
  });

  it("opens on the attention tab with the supervisor's reassignment and reminder actions", () => {
    render(<SupervisorLeadsRadar data={data} now={now} />);
    expect(screen.getByText("1 lead precisa de você")).toBeTruthy();
    const card = screen.getByRole("list", { name: "Leads que precisam de você" });
    expect(within(card).getByRole("link", { name: /Maria Silva/ }).getAttribute("href")).toBe("/leads/lead-1");
    expect(within(card).getByText("Indicação")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Repassar" }).getAttribute("href")).toContain("/equipe/repassar?lead=lead-1");
    expect(within(card).getByRole("link", { name: /Cobrar Ana/ }).getAttribute("href")).toContain("brokerId=broker-1");
    expect(within(card).queryByText("João Lima")).toBeNull();
  });

  it("gives the manager the conversation link instead of the supervisor actions", () => {
    render(<SupervisorLeadsRadar data={{ ...data, leads: [{ ...late, clientWaitingSince: "2026-10-10T10:20:00.000Z" }] }} now={now} audience="manager" />);
    expect(screen.getByRole("heading", { name: "Leads da unidade" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver conversa" }).getAttribute("href")).toBe("/mensagens/lead-1");
    expect(screen.getByRole("link", { name: /Maria Silva/ }).getAttribute("href")).toBe("/leads/lead-1");
    expect(screen.queryByRole("link", { name: "Repassar" })).toBeNull();
  });

  it("filters by broker, tag and search across the tabs", () => {
    render(<SupervisorLeadsRadar data={data} now={now} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Situação dos leads" })).getByRole("button", { name: "Abertos" }));
    expect(screen.getByRole("link", { name: /João Lima/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Paulo Dias/ }));
    expect(screen.queryByRole("link", { name: /Maria Silva/ })).toBeNull();
    expect(screen.getByRole("link", { name: /João Lima/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tag" })).getByRole("button", { name: /Indicação/ }));
    expect(screen.getByRole("link", { name: /Maria Silva/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /João Lima/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar lead ou corretor" }), { target: { value: "0000" } });
    expect(screen.getByRole("link", { name: /Maria Silva/ })).toBeTruthy();
  });
});
