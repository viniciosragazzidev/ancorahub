// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/goals/lite-goals-actions", () => ({ saveLiteGoalAction: vi.fn() }));
vi.mock("@/components/arc/action-button/action-button", () => ({ ActionButton: ({ label }: { label: string }) => <button type="button">{label}</button> }));
vi.mock("@/components/arc/input/input", () => ({ Input: ({ label, id }: { label: string; id: string }) => <label htmlFor={id}>{label}<input id={id} /></label> }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button> }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: () => null }));

import type { LiteGoalView } from "@/features/goals/lite-goals-queries";

import { BrokerMonthGoal } from "./goals-section";

afterEach(() => cleanup());

const goal: LiteGoalView = { id: "g-1", scope: "broker", scopeId: "bruno", name: "Cotações de outubro", targetType: "quotes_count", targetValue: 8, period: "2026-10", current: 6, percentage: 75 };

describe("meta do mês no perfil do corretor", () => {
  it("shows the broker's month goal as 'current of target · percent' with a bar", () => {
    render(<BrokerMonthGoal brokerId="bruno" brokerName="Bruno" period="2026-10" goal={goal} canEdit={false} />);

    expect(screen.getByText("Meta do mês")).toBeTruthy();
    expect(screen.getByText("6 de 8 cotações · 75%")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
  });

  it("lets the supervisor of the broker edit it, and says so when there is no goal", () => {
    const { unmount } = render(<BrokerMonthGoal brokerId="bruno" brokerName="Bruno" period="2026-10" goal={goal} canEdit />);
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    unmount();

    render(<BrokerMonthGoal brokerId="bruno" brokerName="Bruno" period="2026-10" goal={null} canEdit />);
    expect(screen.getByText("Sem meta neste mês.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Definir meta" })).toBeTruthy();
  });
});
