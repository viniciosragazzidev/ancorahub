// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetFirstTimeTodayMemory } from "@/components/motion/first-time-today/first-time-today-core";

const mocks = vi.hoisted(() => ({ once: vi.fn() }));
vi.mock("@/lib/feedback/use-feedback", () => ({ fireFeedbackOnce: mocks.once }));

import { GoalReached, resetGoalReachedOwner } from "./goal-reached";

beforeEach(() => {
  window.localStorage.clear();
  resetFirstTimeTodayMemory();
  resetGoalReachedOwner();
  mocks.once.mockReset().mockReturnValue({ kind: "milestone", level: 2, sound: "milestone", haptic: [12, 40, 24], motion: true, celebrate: true });
});
afterEach(cleanup);

describe("meta do dia batida", () => {
  it("sem meta batida não comemora nem gasta o dia", () => {
    render(<GoalReached reached={false} kind="goal"><span>barra</span></GoalReached>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.once).not.toHaveBeenCalled();
  });

  it("na primeira vez do dia: marco de nível 2 com a chave meta-do-dia e texto de colega", () => {
    render(<GoalReached reached kind="goal"><span>barra</span></GoalReached>);
    expect(mocks.once).toHaveBeenCalledWith(expect.stringMatching(/^meta-do-dia:/), "milestone", { budgetKey: "meta-do-dia" });
    expect(screen.getByRole("status").textContent).toMatch(/meta/i);
  });

  it("nas outras visitas do dia a barra só aparece cheia", () => {
    render(<GoalReached reached kind="goal"><span>barra</span></GoalReached>);
    cleanup();
    resetGoalReachedOwner();
    mocks.once.mockClear();
    render(<GoalReached reached kind="goal"><span>barra</span></GoalReached>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.once).not.toHaveBeenCalled();
  });

  it("meta e missão batidas na mesma tela: só uma comemora", () => {
    render(<>
      <GoalReached reached kind="goal"><span>meta</span></GoalReached>
      <GoalReached reached kind="mission"><span>missão</span></GoalReached>
    </>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(mocks.once).toHaveBeenCalledTimes(1);
  });
});
