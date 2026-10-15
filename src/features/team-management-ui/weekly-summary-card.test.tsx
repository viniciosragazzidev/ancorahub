// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/features/journey/recognition-actions", () => ({ recognizeBrokerAction: vi.fn() }));
vi.mock("@/features/journey/components/recognize-sheet", () => ({ RecognizeSheet: ({ open, brokerName }: { open: boolean; brokerName: string }) => open ? <div role="dialog">Reconhecer {brokerName}</div> : null }));

import type { WeeklySummaryValues } from "@/features/team-management/g6-pure";
import { WeeklySummaryCard } from "./weekly-summary-card";

afterEach(() => cleanup());

const summary: WeeklySummaryValues = {
  leadsReceived: 14, received: 12, accepted: 9, acceptanceRate: 75, slaRate: 80, conversionRate: 25,
  highlights: [{ category: "conversion", label: "Maior conversão", brokerId: "b-1", brokerName: "Ana", value: "25%" }],
};

describe("WeeklySummaryCard", () => {
  it("renders the summary and scoped automatic highlights", () => {
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.getByRole("heading", { name: "Esta semana" })).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ana" }).getAttribute("href")).toBe("/equipe/b-1");
    expect(screen.queryByRole("button", { name: "Reconhecer corretor" })).toBeNull();
  });

  it("offers the supervisor manual recognition flow with the existing reason sheet", () => {
    render(<WeeklySummaryCard summary={summary} canRecognize manualRecognitionBrokers={[{ id: "b-1", name: "Ana" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Reconhecer corretor" }));
    expect(screen.getByRole("dialog").textContent).toBe("Reconhecer Ana");
  });
});
