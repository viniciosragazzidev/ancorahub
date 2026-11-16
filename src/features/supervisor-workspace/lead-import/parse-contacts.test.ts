import { describe, expect, it } from "vitest";

import { parseContactLine, parseContactList, planShares } from "./parse-contacts";

describe("parseContactLine", () => {
  it("separates name, phone and e-mail in any order", () => {
    expect(parseContactLine("maria da silva - (21) 99876-5432 - maria@exemplo.com", 1)).toMatchObject({
      name: "Maria da Silva", phone: "5521998765432", phoneLabel: "(21) 99876-5432", email: "maria@exemplo.com", problem: null,
    });
    expect(parseContactLine("joao@exemplo.com;+55 11 91234-5678;JOÃO PEREIRA", 2)).toMatchObject({
      name: "João Pereira", phone: "5511912345678", email: "joao@exemplo.com", problem: null,
    });
  });

  it("explains what is wrong instead of importing it", () => {
    expect(parseContactLine("Carlos 2122223333", 1)?.problem).toMatch(/fixo/);
    expect(parseContactLine("Ana Souza", 1)?.problem).toBe("Sem telefone.");
    expect(parseContactLine("21998765432", 1)?.problem).toBe("Sem nome.");
  });
});

describe("parseContactList", () => {
  it("skips the header, empty lines and marks repeated phones", () => {
    const list = parseContactList("nome,telefone,email\nAna,21998765432,ana@x.com\n\nBeto,(21) 99876-5432\nCaio,11912345678");
    expect(list.contacts.map((c) => c.name)).toEqual(["Ana", "Beto", "Caio"]);
    expect(list.contacts[1].problem).toBe("Repetido nesta lista.");
    expect(list.contacts[2].problem).toBeNull();
  });

  it("keeps at most 50 and says how many were left out", () => {
    const text = Array.from({ length: 53 }, (_, i) => `Pessoa ${String.fromCharCode(65 + (i % 26))} 21 9${String(80000000 + i).padStart(8, "0")}`).join("\n");
    const list = parseContactList(text);
    expect(list.contacts).toHaveLength(50);
    expect(list.overflow).toBe(3);
  });
});

describe("planShares", () => {
  it("splits equally and gives the remainder to the first ones", () => {
    expect(planShares(10, ["a", "b", "c"])).toEqual({ shares: [{ brokerId: "a", count: 4 }, { brokerId: "b", count: 3 }, { brokerId: "c", count: 3 }], left: 0 });
  });

  it("never hands out more than the total with chosen quantities", () => {
    expect(planShares(5, ["a", "b"], { a: 3, b: 4 })).toEqual({ shares: [{ brokerId: "a", count: 3 }, { brokerId: "b", count: 2 }], left: 0 });
    expect(planShares(5, ["a", "b"], { a: 1 })).toEqual({ shares: [{ brokerId: "a", count: 1 }], left: 4 });
  });
});
