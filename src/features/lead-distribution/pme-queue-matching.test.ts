import { describe, expect, it } from "vitest";

import { isPersonQueueName, isPmeQueueName, pickPmeQueue } from "./pme-queue-matching";

const queue = (id: string, name: string, branchId: string | null = "matriz") => ({ id, name, branchId });

describe("PME queue matching", () => {
  it("tells person queues from company queues by name", () => {
    expect(isPersonQueueName("FILA PF")).toBe(true);
    expect(isPersonQueueName("Fila Premium")).toBe(true);
    expect(isPersonQueueName("FILA PF - RENAN")).toBe(true);
    expect(isPersonQueueName("Fila PME")).toBe(false);
    expect(isPersonQueueName("Pós Venda")).toBe(false);
    expect(isPmeQueueName("FILA PME - RENAN")).toBe(true);
    expect(isPmeQueueName("Fila PF")).toBe(false);
  });

  it("sends every company lead to FILA PME - RENAN when it exists, FILA TATIANA included (20/10)", () => {
    const candidates = [queue("pme", "Fila PME"), queue("pme-renan", "FILA PME - RENAN"), queue("pme-outra", "Fila PME", "filial")];
    expect(isPersonQueueName("FILA TATIANA")).toBe(true);
    expect(pickPmeQueue(queue("tatiana", "FILA TATIANA"), candidates)?.id).toBe("pme-renan");
    expect(pickPmeQueue(queue("pf", "FILA PF"), candidates)?.id).toBe("pme-renan");
    expect(pickPmeQueue(queue("premium", "Fila Premium", "filial"), candidates)?.id).toBe("pme-renan");
    expect(pickPmeQueue(queue("pme-renan", "FILA PME - RENAN"), candidates)).toBeNull();
  });

  it("without FILA PME - RENAN, picks the PME queue of the same owner, then the same unit", () => {
    const candidates = [queue("pme", "Fila PME"), queue("pme-joao", "FILA PME - JOAO"), queue("pme-outra", "Fila PME", "filial")];
    expect(pickPmeQueue(queue("pf-joao", "FILA PF - JOAO"), candidates)?.id).toBe("pme-joao");
    expect(pickPmeQueue(queue("pf", "FILA PF"), candidates)?.id).toBe("pme");
    expect(pickPmeQueue(queue("pf-filial", "Fila PF", "filial"), candidates)?.id).toBe("pme-outra");
  });

  it("never moves out of a queue that is not PF/Premium, nor without a PME queue", () => {
    expect(pickPmeQueue(queue("pos", "Pós Venda"), [queue("pme", "Fila PME")])).toBeNull();
    expect(pickPmeQueue(queue("pme", "Fila PME"), [queue("pme2", "Fila PME 2")])).toBeNull();
    expect(pickPmeQueue(queue("pf", "Fila PF"), [queue("pos", "Pós Venda")])).toBeNull();
  });
});
