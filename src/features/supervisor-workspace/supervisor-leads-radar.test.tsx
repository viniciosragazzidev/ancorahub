// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, render, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { render?: React.ReactElement<{ href?: string }> }) => render ? <a href={render.props.href}>{children}</a> : <button {...props}>{children}</button> }));
vi.mock("@/components/arc/search-field/search-field", () => ({ SearchField: ({ value, onValueChange, label }: { value: string; onValueChange: (value: string) => void; label: string }) => <label>{label}<input value={value} onChange={(event) => onValueChange(event.target.value)} /></label> }));
vi.mock("@/components/arc/chip-group/chip-group", () => ({ default: ({ label, options, value, onValueChange }: { label: string; options: Array<{ value: string; label: string }>; value: string[]; onValueChange: (value: string[]) => void }) => <div aria-label={label}>{options.map((option) => <button type="button" key={option.value} aria-pressed={value.includes(option.value)} onClick={() => onValueChange(value.includes(option.value) ? [] : [option.value])}>{option.label}</button>)}</div> }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name, className }: { name: string; className?: string }) => <span className={className} role="img" aria-label={name}>{name}</span> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/metric-card/metric-card", () => ({ MetricCard: ({ label, value }: { label: string; value: number }) => <span>{label} {value}</span> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description }: { title: string; description: string }) => <section><strong>{title}</strong><p>{description}</p></section> }));

import { classifyRadarLead, SupervisorLeadsRadar, type RadarLead } from "./supervisor-leads-radar";

const lead: RadarLead = { id: "lead-1", name: "Maria Silva", phone: "11999990000", status: "distributed", ownerId: "broker-1", ownerName: "Ana Souza", ownerImage: null, productName: "PME", assignedAt: "2026-10-10T10:00:00.000Z", firstContactAt: null, stageEnteredAt: null };
const data = { team: [{ id: "broker-1", name: "Ana Souza", image: null, availability: "available", openCount: 1, late: 1 }], leads: [lead], funnel: { new: 1, firstContact: 0, service: 0, quote: 0, closing: 0 }, slaMinutes: 15 };

afterEach(() => cleanup());

describe("SupervisorLeadsRadar", () => {
  it("classifies SLA and waiting groups from live timestamps", () => {
    expect(classifyRadarLead(lead, new Date("2026-10-10T10:30:00.000Z"), 15)).toBe("late");
    expect(classifyRadarLead({ ...lead, assignedAt: "2026-10-10T10:29:00.000Z" }, new Date("2026-10-10T10:30:00.000Z"), 15)).toBe("waiting");
  });

  it("shows the overdue owner and quick reassignment and reminder actions", () => {
    render(<SupervisorLeadsRadar data={data} now="2026-10-10T10:30:00.000Z" />);
    expect(screen.getByRole("heading", { name: /Atrasados/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maria Silva" }).getAttribute("href")).toBe("/leads/lead-1");
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Repassar" }).getAttribute("href")).toContain("/equipe/repassar?lead=lead-1");
    expect(screen.getByRole("link", { name: "Cobrar" }).getAttribute("href")).toContain("brokerId=broker-1");
  });

  it("filters the list by phone, broker and funnel stage", () => {
    render(<SupervisorLeadsRadar data={data} now="2026-10-10T10:30:00.000Z" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar lead ou corretor" }), { target: { value: "0000" } });
    expect(screen.getByRole("link", { name: "Maria Silva" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ana Souza" }));
    expect(screen.getByRole("link", { name: "Maria Silva" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Funil da equipe" })).getByRole("button", { name: /Novos/ }));
    expect(screen.getByRole("link", { name: "Maria Silva" })).toBeTruthy();
  });
});
