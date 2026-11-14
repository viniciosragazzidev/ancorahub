// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fire = vi.hoisted(() => vi.fn(() => ({ celebrate: false })));
const refresh = vi.hoisted(() => vi.fn());
const saveLiteGoalAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/goals/lite-goals-actions", () => ({ saveLiteGoalAction }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null) }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: () => null }));
vi.mock("@/components/arc/input/input", () => ({ Input: ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => <label>{label}<input {...props} /></label> }));
vi.mock("@/components/arc/action-button/action-button", () => ({
  ActionButton: ({ label, onAction, onActionError, disabled }: { label: string; onAction: () => Promise<void>; onActionError?: (error: unknown) => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => { onAction().catch((error) => onActionError?.(error)); }}>{label}</button>
  ),
}));

import { GoalSheet } from "./goal-sheet";

const target = { scope: "team" as const, scopeId: "sup-1", label: "Equipe Centro", goal: null };

beforeEach(() => { fire.mockClear(); refresh.mockReset(); saveLiteGoalAction.mockReset(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe("GoalSheet feedback", () => {
  it("só confirma depois do servidor e fecha logo depois do check", async () => {
    let resolve: (value: unknown) => void = () => {};
    saveLiteGoalAction.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const onClose = vi.fn();
    render(<GoalSheet target={target} period="2026-11" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Valor da meta"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(fire).toHaveBeenCalledWith("tap");
    expect(fire).not.toHaveBeenCalledWith("confirm");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: true }); });
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(refresh).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(700); });
    expect(onClose).toHaveBeenCalled();
  });

  it("erro mostra a causa e que a meta anterior continua, e o botão vira Tentar de novo", async () => {
    saveLiteGoalAction.mockResolvedValue({ ok: false, message: "O valor da meta precisa ser maior que zero." });
    const onClose = vi.fn();
    render(<GoalSheet target={{ ...target, goal: { id: "g1", name: "Cotações", targetType: "quotes_count", targetValue: 10 } as never }} period="2026-11" onClose={onClose} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salvar meta" })); });
    expect(fire).toHaveBeenCalledWith("error");
    expect(screen.getByRole("alert").textContent).toBe("O valor da meta precisa ser maior que zero. A meta anterior continua valendo.");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
