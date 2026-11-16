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
    const list = parseContactList(text, 50);
    expect(list.contacts).toHaveLength(50);
    expect(list.overflow).toBe(3);
  });
});

describe("other list formats", () => {
  it("joins a name and the phone on the lines below it (copied from WhatsApp)", () => {
    const list = parseContactList("Maria Silva\n(21) 99876-5432\nmaria@exemplo.com\n\nJoão Souza\n+55 11 91234-5678\nPaula 21987650001");
    expect(list.contacts.map((c) => [c.name, c.phone, c.email, c.problem])).toEqual([
      ["Maria Silva", "5521998765432", "maria@exemplo.com", null],
      ["João Souza", "5511912345678", null, null],
      ["Paula", "5521987650001", null, null],
    ]);
  });

  it("reads labelled blocks (Nome:, Tel:, E-mail:)", () => {
    const list = parseContactList("Nome: Carla Dias\nTel: 21 98765-0009\nE-mail: carla@exemplo.com");
    expect(list.contacts).toHaveLength(1);
    expect(list.contacts[0]).toMatchObject({ name: "Carla Dias", phone: "5521987650009", email: "carla@exemplo.com", problem: null });
  });

  it("reads contacts exported from the phone (.vcf), preferring the mobile number", () => {
    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0", "N:Lima;Bruno;;;", "FN:Bruno Lima", "TEL;TYPE=HOME:2122223333", "TEL;TYPE=CELL:+55 21 98765-0010", "EMAIL;TYPE=INTERNET:bruno@exemplo.com", "END:VCARD",
      "BEGIN:VCARD", "VERSION:3.0", "N:Souza;Ana;;;", "TEL;TYPE=CELL:21987650011", "END:VCARD",
    ].join("\r\n");
    const list = parseContactList(vcf);
    expect(list.contacts.map((c) => [c.name, c.phone, c.email])).toEqual([
      ["Bruno Lima", "5521987650010", "bruno@exemplo.com"],
      ["Ana Souza", "5521987650011", null],
    ]);
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
