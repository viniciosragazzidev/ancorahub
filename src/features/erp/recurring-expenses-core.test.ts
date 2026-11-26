import { describe, expect, it } from "vitest";
import {
  addMonths, competenceOf, firstRecurringCompetence, planRecurringExpenses, recurringReference, recurringRowAction, shiftDueOn,
} from "./recurring-expenses-core";

const origin = { reference: "ALUGUEL-SEDE", competence: "2026-11", dueOn: "2026-11-30", status: "approved" };
const rule = { id: "rule-1", status: "active", startsCompetence: "2026-12" };

/** Aplica um plano como o serviço faz: cada mês planejado vira um mês gerado. */
function apply(generated: Set<string>, plan: { competence: string }[]) {
  for (const item of plan) generated.add(item.competence);
}

describe("competência e vencimento", () => {
  it("vira o ano e limita o dia ao fim do mês", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(shiftDueOn("2026-11-30", 3)).toBe("2027-02-28");
    expect(shiftDueOn("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("usa o mês de São Paulo", () => {
    expect(competenceOf(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11");
    expect(competenceOf(new Date("2026-12-01T03:30:00Z"))).toBe("2026-12");
  });
  it("começa no mês seguinte à origem, sem cobrar meses antigos", () => {
    expect(firstRecurringCompetence("2026-11", "2026-11")).toBe("2026-12");
    expect(firstRecurringCompetence("2026-06", "2026-11")).toBe("2026-11");
  });
  it("mantém a referência dentro de 100 caracteres", () => {
    expect(recurringReference("A".repeat(100), "2026-12")).toHaveLength(100);
    expect(recurringReference("ALUGUEL", "2026-12")).toBe("ALUGUEL:2026-12");
  });
});

describe("geração idempotente por origem + mês", () => {
  it("não gera nada antes de o mês virar", () => {
    expect(planRecurringExpenses({ rule, origin, generated: new Set(), current: "2026-11" })).toEqual([]);
  });
  it("gera o mês que virou uma única vez, mesmo abrindo a tela de novo", () => {
    const generated = new Set<string>();
    const first = planRecurringExpenses({ rule, origin, generated, current: "2026-12" });
    expect(first).toEqual([{ competence: "2026-12", dueOn: "2026-12-30", reference: "ALUGUEL-SEDE:2026-12" }]);
    apply(generated, first);
    expect(planRecurringExpenses({ rule, origin, generated, current: "2026-12" })).toEqual([]);
  });
  it("recupera meses pulados sem repetir os já gerados", () => {
    const generated = new Set(["2026-12"]);
    const plan = planRecurringExpenses({ rule, origin, generated, current: "2027-02" });
    expect(plan.map((item) => item.competence)).toEqual(["2027-01", "2027-02"]);
    apply(generated, plan);
    expect(planRecurringExpenses({ rule, origin, generated, current: "2027-02" })).toEqual([]);
  });
  it("pula mês fechado e respeita o limite por abertura", () => {
    expect(planRecurringExpenses({ rule, origin, generated: new Set(), closed: new Set(["2026-12"]), current: "2027-01" }).map((item) => item.competence)).toEqual(["2027-01"]);
    expect(planRecurringExpenses({ rule, origin, generated: new Set(), current: "2028-12", limit: 3 })).toHaveLength(3);
  });
  it("nunca gera o próprio mês da origem", () => {
    expect(planRecurringExpenses({ rule: { ...rule, startsCompetence: "2026-11" }, origin, generated: new Set(), current: "2026-11" })).toEqual([]);
  });
});

describe("Parar de repetir", () => {
  it("regra parada não gera mais nenhum mês", () => {
    expect(planRecurringExpenses({ rule: { ...rule, status: "stopped" }, origin, generated: new Set(), current: "2027-06" })).toEqual([]);
  });
  it("origem rejeitada também não gera", () => {
    expect(planRecurringExpenses({ rule, origin: { ...origin, status: "rejected" }, generated: new Set(), current: "2027-06" })).toEqual([]);
  });
  it("o ⋯ mostra Parar de repetir na série e Repetir todo mês só na despesa avulsa", () => {
    expect(recurringRowAction({ kind: "expense", status: "approved", recurring: true })).toBe("stop");
    expect(recurringRowAction({ kind: "expense", status: "submitted", recurring: false })).toBe("start");
    expect(recurringRowAction({ kind: "expense", status: "rejected", recurring: false })).toBeNull();
    expect(recurringRowAction({ kind: "broker_commission", status: "approved", recurring: false })).toBeNull();
  });
});
