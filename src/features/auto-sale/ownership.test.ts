/**
 * Regra forte (DEC-182): nenhum caminho do agente muda o dono do lead ou cria oferta para corretor.
 * Só `handOffToBroker` (ação manual do gestor, auditada) chama a atribuição do CRM.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "src/features/auto-sale");
/** Fim de linha normalizado: o checkout no Windows pode trazer CRLF. */
const read = (file: string) => readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
const sources = readdirSync(DIR).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
const OWNER_CHANGERS = /assignLeadToBroker|createLeadOffersForBrokers|offerLeadToBrokerManually|distributeQualifiedLead|processQueuedLead|assignLeadToBrokerAction/;

describe("o agente nunca passa o lead a um corretor", () => {
  it("nenhum módulo do agente (turno, entrada, envio, job, cotação) chama atribuição ou oferta", () => {
    for (const file of sources.filter((name) => name !== "service.ts")) {
      expect(read(file), file).not.toMatch(OWNER_CHANGERS);
    }
  });

  it("no serviço, a atribuição só existe dentro da entrega manual do gestor", () => {
    const service = read("service.ts");
    const calls = [...service.matchAll(/assignLeadToBroker\(/g)];
    expect(calls).toHaveLength(1);
    const handOff = service.slice(service.indexOf("export async function handOffToBroker"));
    expect(handOff.slice(0, handOff.indexOf("\n}\n"))).toContain("assignLeadToBroker(");
    expect(service).not.toMatch(/createLeadOffersForBrokers|offerLeadToBrokerManually|distributeQualifiedLead/);
  });

  it("o agente só escreve corretorId para soltar o dono provisório na escolha do gestor (nunca para atribuir)", () => {
    const service = read("service.ts");
    // Fora as leituras (schema.leads.corretorId) e o cálculo da elegibilidade, a única escrita é `null`.
    const writes = [...service.matchAll(/corretorId: ([^,}]+)/g)].map((match) => match[1].trim())
      .filter((value) => !value.startsWith("schema.") && !value.startsWith("provisional ? null") && !value.startsWith("string"));
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((value) => value === "null"), writes.join(" | ")).toBe(true);
    for (const file of sources.filter((name) => name !== "service.ts")) {
      expect([...read(file).matchAll(/corretorId: (?!schema|string)/g)], file).toHaveLength(0);
    }
  });

  it("o aviso de chamada vai só para o gestor que escolheu a negociação", () => {
    const service = read("service.ts");
    const call = service.slice(service.indexOf("export async function callManager"));
    const body = call.slice(0, call.indexOf("\n}\n"));
    expect(body).toContain("recipientUserId: deal.chosenBy");
    expect(body).toContain("recipientId: deal.chosenBy");
    expect(body).not.toMatch(/corretorId|brokerId/);
  });
});
