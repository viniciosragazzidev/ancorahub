import { describe, expect, it } from "vitest";

import { beneficiariesFromMemory, captureBeneficiaryRelations, parseAgeValues } from "./beneficiary-relations";

describe("optional beneficiary relationship capture", () => {
  it("maps ages by order only when every age has one relationship", () => {
    const result = captureBeneficiaryRelations({ message: "eu e meu filho", ages: [46, 10], planType: "familiar", sourceMessageId: "m1" });
    expect(result).toMatchObject({
      status: "mapped",
      relationAsked: true,
      beneficiaries: [
        { age: 46, relation: "titular", sourceMessageId: "m1" },
        { age: 10, relation: "filho", sourceMessageId: "m1" },
      ],
    });
  });

  it("maps ages explicitly named beside each relationship", () => {
    const result = captureBeneficiaryRelations({ message: "você 46, filho 10", ages: [46, 10], planType: "familiar" });
    expect(result.beneficiaries.map(({ age, relation }) => [age, relation])).toEqual([[46, "titular"], [10, "filho"]]);
    const reversed = captureBeneficiaryRelations({ message: "filho 10, eu 46", ages: [46, 10], planType: "familiar" });
    expect(reversed.beneficiaries.map(({ age, relation }) => [age, relation])).toEqual([[46, "titular"], [10, "filho"]]);
  });

  it("does not attach one relationship to two beneficiaries with the same age", () => {
    const result = captureBeneficiaryRelations({ message: "eu tenho 30 anos", ages: [30, 30], planType: "familiar" });
    expect(result).toMatchObject({ status: "ambiguous", raw: "eu tenho 30 anos" });
    expect(result.beneficiaries.every((beneficiary) => beneficiary.relation === null)).toBe(true);
  });

  it("keeps the order for spouse and lead when both are named", () => {
    const result = captureBeneficiaryRelations({ message: "minha esposa e eu", ages: [35, 32], planType: "familiar" });
    expect(result.beneficiaries.map(({ relation }) => relation)).toEqual(["conjuge", "titular"]);
  });

  it("does not map by order when ages contradict the stated relationships", () => {
    const childBeforeLead = captureBeneficiaryRelations({ message: "meu filho e eu", ages: [46, 10], planType: "familiar" });
    expect(childBeforeLead).toMatchObject({ status: "ambiguous", raw: "meu filho e eu" });
    expect(childBeforeLead.beneficiaries.every((beneficiary) => beneficiary.relation === null)).toBe(true);

    const leadBeforeChild = captureBeneficiaryRelations({ message: "eu e meu filho", ages: [46, 10], planType: "familiar" });
    expect(leadBeforeChild.beneficiaries.map(({ age, relation }) => [age, relation])).toEqual([[46, "titular"], [10, "filho"]]);
  });

  it("requires adults for titular and spouse and a titular age for child or parent order mappings", () => {
    expect(captureBeneficiaryRelations({ message: "eu e minha esposa", ages: [16, 17], planType: "familiar" }).status).toBe("ambiguous");
    expect(captureBeneficiaryRelations({ message: "minha mãe e eu", ages: [35, 60], planType: "familiar" }).status).toBe("ambiguous");
    expect(captureBeneficiaryRelations({ message: "meu filho e minha esposa", ages: [10, 35], planType: "familiar" }).status).toBe("ambiguous");
  });

  it("does not guess when a plural relationship cannot be assigned to each age", () => {
    const result = captureBeneficiaryRelations({ message: "filhos", ages: [35, 32], planType: "familiar" });
    expect(result).toMatchObject({ status: "ambiguous", raw: "filhos" });
    expect(result.beneficiaries.every((beneficiary) => beneficiary.relation === null)).toBe(true);
  });

  it("does not treat an unrelated mention of a child as the answer", () => {
    const result = captureBeneficiaryRelations({ message: "meu filho ainda não tem plano", ages: [35, 32], planType: "familiar" });
    expect(result.status).toBe("unrecognized");
    expect(result.raw).toBeUndefined();
  });

  it("keeps partial answers from the optional prompt as unconfirmed text", () => {
    expect(captureBeneficiaryRelations({ message: "minha esposa", ages: [35, 32], planType: "familiar", relationAsked: true }))
      .toMatchObject({ status: "ambiguous", raw: "minha esposa" });
    expect(captureBeneficiaryRelations({ message: "a família toda", ages: [35, 32], planType: "familiar", relationAsked: true }))
      .toMatchObject({ status: "ambiguous", raw: "a família toda" });
    expect(captureBeneficiaryRelations({ message: "meu filho ainda não tem plano", ages: [35, 32], planType: "familiar", relationAsked: true }).status)
      .toBe("unrecognized");
  });

  it("captures familiar terms without inventing a relationship category", () => {
    expect(captureBeneficiaryRelations({ message: "eu e meu neto", ages: [61, 8], planType: "familiar" }).beneficiaries.map((item) => item.relation))
      .toEqual(["titular", "neto"]);
    expect(captureBeneficiaryRelations({ message: "minha sogra e eu", ages: [68, 40], planType: "familiar" }).beneficiaries.map((item) => item.relation))
      .toEqual(["pai_mae", "titular"]);
    expect(captureBeneficiaryRelations({ message: "meu irmão e eu", ages: [28, 31], planType: "familiar" }).beneficiaries.map((item) => item.relation))
      .toEqual(["outro", "titular"]);
    expect(captureBeneficiaryRelations({ message: "meu cunhado e eu", ages: [28, 31], planType: "familiar" }).beneficiaries.map((item) => item.relation))
      .toEqual(["outro", "titular"]);
  });

  it("treats a boyfriend as another person on an individual plan", () => {
    const result = captureBeneficiaryRelations({ message: "meu namorado e eu", ages: [29, 27], planType: "individual" });
    expect(result.beneficiaries.map((item) => item.relation)).toEqual(["outro", "titular"]);
  });

  it.each(["prefiro não falar", "pode seguir"])('records the optional decline "%s" without creating a relationship', (message) => {
    const result = captureBeneficiaryRelations({ message, ages: [46, 10], planType: "familiar" });
    expect(result).toMatchObject({ status: "declined", relationAsked: true });
    expect(result.raw).toBeUndefined();
    expect(result.beneficiaries.every((beneficiary) => beneficiary.relation === null)).toBe(true);
  });

  it("reads ages from legacy memory without attaching an old relation to the wrong person", () => {
    expect(beneficiariesFromMemory({ collectedFields: [], beneficiaryRelation: "filha" }, [35, 10]))
      .toEqual([{ age: null, relation: "outro", relationText: "filha" }]);
    expect(parseAgeValues("35 e 10 anos")).toEqual([35, 10]);
  });
});
