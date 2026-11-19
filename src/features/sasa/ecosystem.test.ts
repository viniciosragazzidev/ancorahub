import { describe, expect, it, vi } from "vitest";

import { LAB_SASA_OPEN, LAB_SASA_QUESTIONS, labSasaAsk, labSasaFacts, labSasaWorld } from "@/app/dev/laboratorio/sasa-lab";

import { runSasaAgentLoop, SASA_AGENT_MAX_READS } from "./ecosystem-agent";
import { answerFromFacts } from "./ecosystem-answers";
import { areasOf, looksLikeQuestion } from "./ecosystem-areas";
import { classifySasaText } from "./intent-rules";

// Quinta, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T14:00:00-03:00");
const world = labSasaWorld(now);
const ask = async (question: string) => {
  const [block] = await labSasaAsk(question, world, now);
  return block?.type === "assistant" ? block.text : "";
};

describe("perguntas do usuário: comissões e vendas (números do Meu financeiro e da tabela de vendas)", () => {
  it("quanto tenho a receber?", async () => {
    expect(await ask("Quanto tenho a receber?")).toBe("Você tem R$ 3.450,00 de comissão a receber. A próxima parcela é de R$ 450,00, de Marcos, em 12/2026.");
  });
  it("quanto recebi este mês?", async () => {
    expect(await ask("Quanto recebi este mês?")).toBe("Em novembro de 2026 você recebeu R$ 1.280,50 de comissão.");
  });
  it("quanto vou receber no mês que vem?", async () => {
    expect(await ask("Quanto vou receber no mês que vem?")).toBe("Pelo cronograma das suas vendas, o previsto para dez/26 é R$ 1.125,00.");
  });
  it("quantas vendas fiz este mês?", async () => {
    expect(await ask("Quantas vendas fiz este mês?")).toBe("Em novembro você registrou 4 vendas, somando R$ 5.960,00. No total são 31 vendas.");
  });
  it("quais foram minhas últimas vendas?", async () => {
    expect(await ask("Quais foram minhas últimas vendas?")).toBe("Suas últimas vendas: 17/11 Marcos, Amil S380, R$ 1.290,00; 13/11 Paula, SulAmérica Exato, R$ 1.870,00.");
  });
  it("quanto vendi em valor?", async () => {
    expect(await ask("Quanto vendi em valor?")).toBe("Em novembro você vendeu R$ 5.960,00 em 4 vendas. No total, R$ 41.870,00 em 31 vendas.");
  });
  it("sem acesso ao Meu financeiro, diz isso em vez de inventar", () => {
    expect(answerFromFacts("Quanto tenho a receber?", "finance", { finance: { access: false } }, now)).toBe("Você não tem acesso ao Meu financeiro, então não consigo ver suas comissões. Se precisar, peça à gestão para liberar.");
  });
  it("valor ainda sem base no ERP aparece como sem dado, nunca zero inventado", () => {
    const finance = { ...(labSasaFacts(now).finance as Extract<NonNullable<ReturnType<typeof labSasaFacts>["finance"]>, { access: true }>), receivedThisMonthCents: null };
    expect(answerFromFacts("Quanto recebi?", "finance", { finance }, now)).toBe("Em novembro de 2026 você recebeu sem dado ainda de comissão.");
  });
});

describe("uma pergunta pronta de cada área do corretor", () => {
  const expected: Record<string, string | RegExp> = {
    "Quantos leads novos eu tenho?": "Você tem 1 lead novo esperando atendimento. Hoje chegaram 3 e você aceitou 2.",
    "Quem está esperando resposta e há quanto tempo?": "2 pessoas estão esperando você: Júlia (lead novo há 6 min); Carlos (respondeu há 25 min).",
    "Me fala da Ana Souza": 'Ana Souza está cotação enviada, com você há 2 dias. Último contato: Ana escreveu em 19/11: "Vou ver com meu marido e te falo". Próximo passo: Ligar para tirar a dúvida da carência do filho.',
    "Quais clientes renovam nos próximos 90 dias?": "2 clientes renovam nos próximos 90 dias: Marcos (a partir de 02/12); Paula (a partir de 15/12).",
    "Tem aniversário de contrato chegando?": "Aniversários de contrato nos próximos 30 dias: Rita em 28/11 (1 ano).",
    "Qual é minha escala da semana?": "Seus plantões nos próximos 7 dias: sex., 20/11 14:00 às 18:00 (PME Manhã); dom., 22/11 14:00 às 22:00 (Presencial Centro).",
    "Estou confirmado no plantão?": "Você está confirmado no TESTE.",
    "Quais retornos tenho na semana?": "2 retornos nos próximos 7 dias: 19/11 16:00 Pedro; 21/11 14:00 Carlos.",
    "Quanto falta para a meta?": "Meta Vendas de novembro: 6 de 10 (60%). Faltam 4.",
    "Qual meu tempo de primeira resposta?": "Nos últimos 7 dias, você aceitou em 48 s e começou o atendimento em 7 min (mediana).",
    "Quais propostas estão pendentes?": "Pendentes: cotação 19/11 Pedro; proposta 17/11 Carlos.",
    "O que tenho de novo nos avisos?": "Você tem 2 avisos novos: Escala de dezembro publicada; Recado da gestão. Estão em Notificações, no sino do Início.",
    "Meu WhatsApp está conectado?": "Seu WhatsApp está conectado desde 07/11.",
    "Estou disponível ou pausado?": "Você está disponível, recebendo leads.",
  };

  it.each(LAB_SASA_QUESTIONS.filter(([area]) => area !== "finance" && area !== "sales"))("%s: %s", async (area, question) => {
    expect(areasOf(question).concat(area === "lead" ? ["lead"] : [])).toContain(area);
    // Nenhuma vira comando: todas chegam às respostas do ecossistema.
    expect(classifySasaText(question)).toBeNull();
    const want = expected[question];
    expect(want).toBeDefined();
    const text = await ask(question);
    if (want instanceof RegExp) expect(text).toMatch(want);
    else expect(text).toBe(want);
  });
});

describe("pergunta nunca escreve", () => {
  it.each([
    "O que a Ana disse?",
    "Quantas vendas eu fechei este mês?",
    "Quantos leads eu tenho em negociação?",
    "Quais cotações eu fiz?",
  ])("%s → leitura, não comando", (question) => {
    expect(classifySasaText(question)).toBeNull();
  });

  it("os pedidos continuam funcionando", () => {
    expect(classifySasaText("a Ana disse que vai pensar")).toEqual({ tool: "lead.note" });
    expect(classifySasaText("fechou a venda do Carlos")).toEqual({ tool: "sale.start" });
    expect(classifySasaText("o Carlos está em negociação")).toEqual({ tool: "lead.stage", status: "negotiation" });
    expect(classifySasaText("quando é meu próximo plantão?")).toEqual({ tool: "duty.next" });
    expect(classifySasaText("tenho retorno atrasado?")).toEqual({ tool: "agenda.list" });
    expect(looksLikeQuestion("a Ana disse que vai pensar")).toBe(false);
  });
});

describe("IA dinâmica e limitada", () => {
  it("combina leituras e responde (perguntas abertas do laboratório)", async () => {
    expect(await ask(LAB_SASA_OPEN[1]!)).toContain("Comece pela Júlia");
    expect(await ask(LAB_SASA_OPEN[2]!)).toContain("O Carlos está em atendimento");
  });

  it("estoura o teto de 4 consultas: devolve o que viu e diz o que faltou", async () => {
    const text = await ask(LAB_SASA_OPEN[3]!);
    expect(text).toMatch(/^Respondo com o que consegui ver \(cheguei ao limite de 4 consultas\)/);
    expect(text).toContain("teto atingido");
  });

  it("nunca passa de 4 leituras nem relê a mesma fonte", async () => {
    const read = vi.fn(async (area: string) => `dados de ${area}`);
    const asks = ["leads", "leads", "wallet", "agenda", "finance", "sales", "notifications"];
    let index = 0;
    const result = await runSasaAgentLoop({
      question: "tudo",
      read,
      ask: async () => ({ action: "read" as const, area: asks[index++] as "leads", lead: null, text: null }),
    });
    expect(read).toHaveBeenCalledTimes(SASA_AGENT_MAX_READS);
    expect(read.mock.calls.map(([area]) => area)).toEqual(["leads", "wallet", "agenda", "finance"]);
    expect(result).toMatchObject({ truncated: true, reason: "reads" });
  });

  it("para no tempo máximo e responde com o que tem", async () => {
    let clock = 0;
    const result = await runSasaAgentLoop({
      question: "como foi minha semana?",
      clock: () => clock,
      deadlineMs: 15_000,
      read: async () => { clock += 9_000; return "17 de 20 ofertas aceitas"; },
      ask: async () => ({ action: "read" as const, area: (["performance", "sales", "leads"] as const)[Math.min(2, Math.floor(clock / 9_000))], lead: null, text: null }),
    });
    expect(result.reason).toBe("time");
    expect(result.text).toContain("o tempo da resposta acabou");
    expect(result.text).toContain("17 de 20 ofertas aceitas");
  });

  it("sem resposta do modelo, não inventa", async () => {
    const result = await runSasaAgentLoop({ question: "oi", read: vi.fn(), ask: async () => null });
    expect(result).toMatchObject({ truncated: true, reason: "model", text: "Não consegui responder agora. Tente perguntar de outro jeito ou mais curto." });
  });
});
