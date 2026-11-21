import { describe, expect, it, vi } from "vitest";

import { labSasaWorld, LAB_SASA_SPEECH } from "@/app/dev/laboratorio/sasa-lab";
import type { ChatBlock } from "@/components/chat/types";

import { declineReasonOf, draftMessageOf, lostReasonOf, runSasaCommand, type SasaRun } from "./command-core";
import { classifySasaText, splitSasaSteps } from "./intent-rules";

// Quinta, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T14:00:00-03:00");
const ok: SasaRun = async () => ({ ok: true, message: "ok" });

function question(blocks: ChatBlock[]) {
  const block = blocks.find((item) => item.type === "question");
  if (!block || block.type !== "question") throw new Error("sem pergunta");
  return block;
}

describe("intenções da fase 5", () => {
  it.each([
    ["Aceita o lead da Júlia", { tool: "lead.accept" }],
    ["aceito", { tool: "lead.accept" }],
    ["recusa, ela é de outra cidade", { tool: "lead.decline" }],
    ["O Pedro desistiu, achou caro", { tool: "lead.lost" }],
    ["a Ana fechou com outra corretora", { tool: "lead.lost" }],
    ["manda pra Ana que a proposta sai amanhã", { tool: "message.draft" }],
    ["anota que a Ana vai pensar", { tool: "lead.note" }],
    // Continuam como antes:
    ["a Ana aceitou a proposta", null],
    ["fechou a venda do Carlos", { tool: "sale.start" }],
    ["mandei a cotação pro Carlos", { tool: "lead.stage", status: "quote_sent" }],
    // Pergunta nunca escreve:
    ["o Pedro desistiu?", null],
  ])("%s", (text, intent) => {
    expect(classifySasaText(text)).toEqual(intent);
  });

  it("corta vários passos só antes de um verbo de pedido", () => {
    expect(splitSasaSteps("anota que a Ana vai pensar e marca retorno com ela sexta às 10")).toEqual(["anota que a Ana vai pensar", "marca retorno com ela sexta às 10"]);
    expect(splitSasaSteps("a Ana e o marido vão pensar")).toEqual(["a Ana e o marido vão pensar"]);
  });

  it("motivos e rascunho pela fala", () => {
    expect(lostReasonOf("o Pedro desistiu, achou caro")).toBe("preco");
    expect(lostReasonOf("ela sumiu")).toBe("sem_contato");
    expect(lostReasonOf("desistiu")).toBe("desistiu");
    expect(declineReasonOf("recusa, ela é de outra cidade")).toBe("Lead fora do meu perfil");
    expect(declineReasonOf("recusa, ela quer odonto")).toBe("Outro: ela quer odonto");
    expect(draftMessageOf("manda pra Ana que a proposta sai amanhã", "Ana")).toBe("Oi, Ana! A proposta sai amanhã.");
  });
});

describe("sensíveis confirmam em um toque e nunca rodam sozinhos", () => {
  it("aceitar a oferta pergunta antes", async () => {
    const run = vi.fn(ok);
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.aceitar, world: labSasaWorld(now), run });
    expect(run).not.toHaveBeenCalled();
    const ask = question(reply.blocks);
    expect(ask.prompt).toContain("Aceitar Júlia Prado?");
    expect(ask.choices[0]!.action).toEqual({ kind: "server", name: "lead.accept", payload: { leadId: "lab-julia" } });
  });

  it("sem oferta, diz que não há nada para aceitar", async () => {
    const world = { ...labSasaWorld(now), offers: [] };
    const reply = await runSasaCommand({ text: "aceita o lead", world, run: ok });
    expect(reply.blocks[0]).toMatchObject({ text: "Você não tem lead novo esperando aceite agora." });
  });

  it("recusar leva o motivo e oferece outros", async () => {
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.recusar, world: labSasaWorld(now), run: ok });
    const ask = question(reply.blocks);
    expect(ask.choices[0]!.action).toMatchObject({ name: "lead.decline", payload: { leadId: "lab-julia", reason: "Lead fora do meu perfil" } });
    expect(ask.choices.at(-1)!.label).toBe("Deixar pra lá");
  });

  it("perdido leva o motivo e a etapa anterior (para o Desfazer)", async () => {
    const run = vi.fn(ok);
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.perdeu, world: labSasaWorld(now), run });
    expect(run).not.toHaveBeenCalled();
    expect(question(reply.blocks).choices[0]!.action).toEqual({ kind: "server", name: "lead.markLost", payload: { leadId: "lab-pedro", reason: "preco", previous: "in_contact" } });
  });
});

describe("rascunho de mensagem (D3: o corretor envia)", () => {
  it("com contato liberado, abre o WhatsApp com o texto", async () => {
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.mensagem, world: labSasaWorld(now), run: ok, contactOf: async () => "21999990000" });
    expect(reply.blocks[0]).toMatchObject({ text: 'Rascunho para Ana: "Oi, Ana! A proposta sai amanhã de manhã."' });
    const href = (question(reply.blocks).choices[0]!.action as { href: string }).href;
    expect(href).toContain("web.whatsapp.com/send");
    expect(href).toContain(encodeURIComponent("A proposta sai amanhã de manhã."));
  });

  it("sem contato liberado, só a ficha", async () => {
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.mensagem, world: labSasaWorld(now), run: ok, contactOf: async () => null });
    expect(question(reply.blocks).choices[0]!.action).toEqual({ kind: "href", href: "/leads/lab-ana" });
  });
});

describe("vários passos numa frase", () => {
  it("vira uma lista confirmada num toque, com o lead dito valendo para os dois", async () => {
    const run = vi.fn(ok);
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.passos, world: labSasaWorld(now), run });
    expect(run).not.toHaveBeenCalled();
    expect(reply.tool).toBe("plan");
    const ask = question(reply.blocks);
    expect(ask.prompt).toMatch(/^Vou fazer 2 coisas: 1\) Anotar no histórico de Ana: "A Ana vai pensar"; 2\) Marcar retorno com Ana amanhã às 10:00\. Confirma\?$/);
    const action = ask.choices[0]!.action as unknown as { name: string; payload: { steps: string } };
    expect(action.name).toBe("sasa.plan");
    const steps = JSON.parse(action.payload.steps) as Array<{ name: string; payload: Record<string, string> }>;
    expect(steps.map((step) => step.name)).toEqual(["lead.addNote", "lead.scheduleReturn"]);
    expect(steps.every((step) => step.payload.leadId === "lab-ana")).toBe(true);
  });

  it("sem nome em nenhum passo, pergunta de qual lead", async () => {
    const reply = await runSasaCommand({ text: "anota que ela vai pensar e marca retorno sexta às 10", world: labSasaWorld(now), run: ok });
    expect(reply.blocks[0]).toMatchObject({ type: "assistant" });
    expect(JSON.stringify(reply.blocks)).toContain("De qual lead");
  });
});

describe("laboratório: Fazer tudo e Desfazer", () => {
  it("roda os passos na ordem e o Desfazer volta tudo", async () => {
    const { createLabSasa } = await import("@/app/dev/laboratorio/sasa-lab");
    const state = { world: labSasaWorld(now), closed: [] as ReturnType<typeof labSasaWorld>["returns"] };
    const lab = createLabSasa(state, { delay: 0, outcome: "ok" });
    const before = state.world.returns.length;
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.passos, world: state.world, run: lab.run });
    const action = question(reply.blocks).choices[0]!.action as unknown as { name: "sasa.plan"; payload: Record<string, string> };
    const done = await lab.run(action.name, action.payload);
    expect(done.ok).toBe(true);
    expect(state.world.returns.length).toBe(before + 1);
    const undone = await lab.run(done.undo!.action.name, done.undo!.action.payload);
    expect(undone.ok).toBe(true);
    expect(state.world.returns.length).toBe(before);
  });
});
