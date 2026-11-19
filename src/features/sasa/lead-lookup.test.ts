import { describe, expect, it } from "vitest";

import { leadLookupBlocks } from "./ecosystem-answers";
import { areasOf, isLeadLookup } from "./ecosystem-areas";
import { nameHintOf } from "./intent-rules";
import { isProvisionalLeadName, resolveLead } from "./resolve-entities";

// Bug de produção (19/11): "Tem algum lead chamado Antônia?" respondia "Achei mais de um: Lead sem nome, Lead sem nome, Antonia".
const leads = [
  { id: "l1", name: "Lead sem nome", status: "in_contact" },
  { id: "l2", name: "Lead sem nome", status: "in_contact" },
  { id: "l3", name: "Antonia", status: "awaiting_reply" },
  { id: "l4", name: "Antônio Carlos", status: "in_contact" },
  { id: "l5", name: "Tatianne de Sousa", status: "in_contact" },
];
const now = new Date("2026-11-19T14:00:00-03:00");

describe("busca de lead pelo nome", () => {
  it.each(["Tem algum lead chamado Antônia?", "tem algum lead chamado antonia?", "Antonia", "quem é a Antônia?"])("%s → só a Antonia", (question) => {
    expect(resolveLead(question, leads)).toEqual({ kind: "one", lead: leads[2] });
  });

  it("Antônio → Antônio Carlos (Antonia é outro nome)", () => {
    expect(resolveLead("Antônio", leads)).toEqual({ kind: "one", lead: leads[3] });
    expect(resolveLead("como está o Antonio?", leads)).toEqual({ kind: "one", lead: leads[3] });
  });

  it("\"lead sem nome\" não acha ninguém: nome provisório não é pessoa", () => {
    expect(resolveLead("lead sem nome", leads)).toEqual({ kind: "none" });
    expect(resolveLead("tem algum lead?", leads)).toEqual({ kind: "none" });
  });

  it("sobrenome solto acha; primeiro nome vence sobrenome", () => {
    expect(resolveLead("e a Sousa?", leads)).toEqual({ kind: "one", lead: leads[4] });
    const withSurname = [...leads, { id: "l6", name: "Carlos Antunes", status: "in_contact" }];
    expect(resolveLead("Carlos", withSurname)).toEqual({ kind: "one", lead: withSurname[5] });
  });

  it.each([
    ["Lead sem nome", true], ["Sem nome", true], ["", true], ["  ", true], ["Lead WhatsApp (5521…)", true], ["+55 (21) 99999-0000", true],
    ["Antonia", false], ["Lead Ana", false],
  ])("nome provisório: %s → %s", (name, provisional) => {
    expect(isProvisionalLeadName(name)).toBe(provisional);
  });
});

describe("consulta de lead responde direto", () => {
  it("reconhece a consulta e o nome pedido", () => {
    expect(isLeadLookup("Tem algum lead chamado Antônia?")).toBe(true);
    expect(isLeadLookup("quem é o Carlos?")).toBe(true);
    expect(isLeadLookup("como está a Ana?")).toBe(true);
    expect(isLeadLookup("quantos leads eu tenho?")).toBe(false);
    expect(nameHintOf("Tem algum lead chamado Antônia?")).toBe("Antônia");
    // "lead" na pergunta puxaria o resumo da fila; a consulta tira esse resumo (sasaQuestionAreas).
    expect(areasOf("Tem algum lead chamado Antônia?")).toEqual(["leads"]);
  });

  it("um achado: etapa, há quanto tempo está com você, último contato, próximo passo e Abrir; sem sobrenome nem resumo", () => {
    const blocks = leadLookupBlocks({
      lead: {
        kind: "one", id: "l3", name: "Antonia", status: "awaiting_reply", tipo: null, arrivedAt: new Date("2026-11-15T10:00:00-03:00"), since: new Date("2026-11-16T10:00:00-03:00"),
        summary: null, nextStep: "Mandar a cotação da Amil.", objections: [], notes: [],
        lastMessage: { from: "cliente", text: "Pode me mandar os valores?", at: new Date("2026-11-18T09:00:00-03:00") },
      },
    }, now, "t");
    expect(blocks).toEqual([
      { type: "assistant", id: "sasa-lead-t", text: 'Antonia está aguardando resposta, com você há 3 dias. Último contato: Antonia escreveu em 18/11: "Pode me mandar os valores?". Próximo passo: Mandar a cotação da Amil.' },
      { type: "button", id: "sasa-lead-open-t", label: "Abrir Antonia", href: "/leads/l3", tone: "action" },
    ]);
    expect(JSON.stringify(blocks)).not.toMatch(/sobrenome|leads ativos/);
  });

  it("vários de verdade: escolha por toque, sem resumo", () => {
    const blocks = leadLookupBlocks({ lead: { kind: "many", names: ["Ana Souza", "Ana Lima"], leads: [{ id: "a1", name: "Ana Souza" }, { id: "a2", name: "Ana Lima" }] } }, now, "t");
    expect(blocks).toEqual([{
      type: "question", id: "sasa-lead-pick-t", prompt: "Achei 2. Qual deles?",
      choices: [
        { id: "lead-0", label: "Ana Souza", reply: "Ana Souza", action: { kind: "local", value: "ask:Quem é Ana Souza?" } },
        { id: "lead-1", label: "Ana Lima", reply: "Ana Lima", action: { kind: "local", value: "ask:Quem é Ana Lima?" } },
      ],
    }]);
  });

  it("nenhum: diz que não achou, com o nome pedido", () => {
    expect(leadLookupBlocks({ lead: { kind: "none", asked: "Antônia" } }, now, "t")).toEqual([{ type: "assistant", id: "sasa-lead-none-t", text: "Não achei Antônia entre os seus leads ativos." }]);
  });
});
