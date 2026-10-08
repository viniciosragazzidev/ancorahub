// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { MOCK_PLANS } from "@/features/broker-workspace/quote-simulator/mock-data";

import { useQuoteSimulator } from "./use-quote-simulator";

describe("useQuoteSimulator", () => {
  it("starts on the profile step with one life and moves on when the ages are valid", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    expect(result.current.step).toBe(0);
    expect(result.current.beneficiaries).toHaveLength(1);

    act(() => result.current.nextStep());
    expect(result.current.step).toBe(1);
    expect(result.current.error).toBe("");
  });

  it("blocks an invalid age and asks for a whole number between 0 and 120", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => result.current.updateAge("titular", "abc"));
    act(() => result.current.nextStep());

    expect(result.current.step).toBe(0);
    expect(result.current.error).toBe("Informe uma idade inteira entre 0 e 120 anos para cada beneficiário.");
  });

  it("requires 2 to 29 lives for PME", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => result.current.setProfileType("pme"));
    act(() => result.current.nextStep());
    expect(result.current.error).toBe("Para a simulação PME, informe de 2 a 29 beneficiários.");
    expect(result.current.step).toBe(0);

    act(() => result.current.addBeneficiary());
    act(() => {
      const second = result.current.beneficiaries[1];
      result.current.updateAge(second.id, "30");
    });
    act(() => result.current.nextStep());
    expect(result.current.step).toBe(1);
  });

  it("requires entity and profession for the adhesion profile", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => result.current.setProfileType("adhesion"));
    act(() => result.current.nextStep());
    expect(result.current.error).toBe("Informe a entidade e a profissão para o perfil de adesão.");

    act(() => {
      result.current.setEntity("Entidade");
      result.current.setProfession("Profissional da saúde");
    });
    act(() => result.current.nextStep());
    expect(result.current.step).toBe(1);
  });

  it("stops adding dependents at 29 lives", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => {
      for (let index = 0; index < 40; index += 1) result.current.addBeneficiary();
    });
    expect(result.current.beneficiaries).toHaveLength(29);
  });

  it("compares at most three plans", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => {
      for (const plan of MOCK_PLANS.slice(0, 5)) result.current.toggleCompared(plan.id, true);
    });
    expect(result.current.comparedIds).toHaveLength(3);
  });

  it("goes to the summary when a plan is chosen and applies the PME example discount", () => {
    const { result } = renderHook(() => useQuoteSimulator());
    act(() => result.current.setProfileType("pme"));
    act(() => {
      result.current.addBeneficiary();
    });
    act(() => {
      const second = result.current.beneficiaries[1];
      result.current.updateAge(second.id, "28");
    });
    act(() => result.current.setBudget(6000));
    const first = result.current.allResults[0];
    expect(first).toBeTruthy();

    act(() => result.current.choosePlan(first.plan.id));
    expect(result.current.step).toBe(3);
    expect(result.current.familyDiscount).toBe(0.05);
    expect(result.current.finalMonthly).toBe(Math.round(first.pricing.monthlyTotal * 0.95 * 100) / 100);
  });
});
