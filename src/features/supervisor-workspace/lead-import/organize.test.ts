import { describe, expect, it } from "vitest";

import { applyTableAnswer, applyTextAnswer, maskForAi, organizeTable, organizeText, tableRequest, textToTable } from "./organize";

// Mesmo formato da planilha da Valéria (16/11): sem cabeçalho, origem e operadora repetidas, responsável no fim.
const valeria = [
  ["Diniz Junior", "(21) 96556-8116", "Google", "Unimed", "Possui CNPJ: NÃO | Contato: WhatsApp", "", "JACK M 05.11"],
  ["Daniele", "(21) 99070-0856", "Google", "Unimed", "Possui CNPJ: NÃO | Contato: E-mail", "", "JACK M 05.11"],
  ["Luiz Alberto das Neves Venâncio ", "(24) 98111-5091", "Google", "Amil", "Possui CNPJ: SIM | Contato: WhatsApp", "", "JACK M 05.11"],
  ["Anderson Lima ", "(22) 9975-2124", "Google", "Unimed", "Possui CNPJ: NÃO | Contato: WhatsApp", "", "GIOVANE 05.11"],
  ["Roberta", "(21) 99070-0856", "Google", "Unimed", "Possui CNPJ: NÃO | Contato: WhatsApp", "", "GIOVANE 05.11"],
  ["Braian", "(21) 2680-7717", "Google", "Unimed", "Possui CNPJ: SIM | Contato: E-mail", "", "MARISA 06.11"],
];

describe("organizeTable", () => {
  it("reads the name and phone columns and keeps the rest as the lead note", () => {
    const organized = organizeTable(valeria);
    expect(organized.confident).toBe(true);
    expect(organized.map).toMatchObject({ header: null, name: 0, phone: 1, email: null, extras: [2, 3, 4, 6] });
    expect(organized.contacts[0]).toMatchObject({ name: "Diniz Junior", phone: "5521965568116", note: "Google · Unimed · Possui CNPJ: NÃO | Contato: WhatsApp · JACK M 05.11", problem: null });
    expect(organized.contacts[2].name).toBe("Luiz Alberto das Neves Venâncio");
  });

  it("fixes old 8-digit mobiles, flags landlines and repeats", () => {
    const organized = organizeTable(valeria);
    expect(organized.contacts[3]).toMatchObject({ phone: "5522999752124", fixed: "Colocamos o 9 que faltava.", problem: null });
    expect(organized.contacts[4].problem).toBe("Repetido nesta lista.");
    expect(organized.contacts[5].problem).toMatch(/fixo/);
  });

  it("uses the header, skips title rows and repeated headers", () => {
    const rows = [
      ["MARISA – 10/11", "", ""],
      ["CLIENTE", "CONTATO", "EMAIL"],
      ["Chumara", "(21) 98355-5022", "chumara@exemplo.com"],
      ["Ed", "(21) 98772-7504", ""],
      ["CLIENTE", "CONTATO", "EMAIL"],
      ["Thiago", "(21) 98643-8384", ""],
    ];
    const organized = organizeTable(rows);
    expect(organized.map).toMatchObject({ header: 1, name: 0, phone: 1, email: 2 });
    expect(organized.contacts.map((contact) => contact.name)).toEqual(["Chumara", "Ed", "Thiago"]);
    expect(organized.contacts[0].email).toBe("chumara@exemplo.com");
  });

  it("is not confident when two columns look like names", () => {
    const rows = [
      ["Ana Souza", "Carlos Lima", "(21) 98765-0001"],
      ["Bia Rocha", "Davi Melo", "(21) 98765-0002"],
      ["Caio Reis", "Eva Nunes", "(21) 98765-0003"],
    ];
    expect(organizeTable(rows).confident).toBe(false);
  });
});

describe("organizeText", () => {
  it("reads text pasted from Excel as columns", () => {
    const text = valeria.map((row) => row.join("\t")).join("\n");
    expect(textToTable(text)).not.toBeNull();
    const organized = organizeText(text);
    expect(organized.mode).toBe("tabela");
    expect(organized.contacts[0].name).toBe("Diniz Junior");
  });

  it("keeps the line-by-line reader for loose text", () => {
    const organized = organizeText("Maria Silva (21) 99876-5432\nJoão Souza 11912345678");
    expect(organized.mode).toBe("texto");
    expect(organized.contacts.map((contact) => contact.name)).toEqual(["Maria Silva", "João Souza"]);
  });
});

describe("AI layer", () => {
  it("sends only the shape: no digits, no e-mail user", () => {
    expect(maskForAi("(21) 99876-5432 maria@exemplo.com")).toBe("(##) #####-#### xxx@exemplo.com");
    const request = tableRequest(valeria);
    expect(JSON.stringify(request)).not.toMatch(/\d/);
  });

  it("accepts a column map that matches the sheet and rejects one that does not", () => {
    const ambiguous = [
      ["Ana Souza", "Carlos Lima", "(21) 98765-0001"],
      ["Bia Rocha", "Davi Melo", "(21) 98765-0002"],
    ];
    const good = applyTableAnswer(ambiguous, { kind: "tabela", header: null, name: 1, phone: 2, email: null });
    expect(good?.aiUsed).toBe(true);
    expect(good?.contacts.map((contact) => contact.name)).toEqual(["Carlos Lima", "Davi Melo"]);
    expect(good?.contacts[0].note).toBe("Ana Souza");
    // Telefone apontado para uma coluna de nomes, coluna inexistente ou repetida: ignorado.
    expect(applyTableAnswer(ambiguous, { kind: "tabela", header: null, name: 2, phone: 0, email: null })).toBeNull();
    expect(applyTableAnswer(ambiguous, { kind: "tabela", header: null, name: 0, phone: 9, email: null })).toBeNull();
    expect(applyTableAnswer(ambiguous, { kind: "tabela", header: null, name: 2, phone: 2, email: null })).toBeNull();
  });

  it("joins the lines the AI grouped and rejects invented or repeated lines", () => {
    const text = "Contatos de hoje\nMaria Silva\nWhats: (21) 99876-5432\nJoão\n11912345678";
    const organized = applyTextAnswer(text, { kind: "texto", groups: [[2, 3], [4, 5]] });
    expect(organized?.contacts.map((contact) => [contact.name, contact.phone])).toEqual([["Maria Silva", "5521998765432"], ["João", "5511912345678"]]);
    expect(applyTextAnswer(text, { kind: "texto", groups: [[2, 3], [3, 4]] })).toBeNull();
    expect(applyTextAnswer(text, { kind: "texto", groups: [[2, 30]] })).toBeNull();
  });
});
