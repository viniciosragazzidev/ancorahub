import { describe, expect, it } from "vitest";

import { isPostSaleQueueName, normalizeQueueName, postSaleTransferAuditAction } from "./post-sale-transfer";

describe("post-sale transfer exemption (DEC-133)", () => {
  it("reconhece a fila Pós Venda em variações de caixa, acento e hífen", () => {
    expect(isPostSaleQueueName("Pós Venda")).toBe(true);
    expect(isPostSaleQueueName("POS VENDA")).toBe(true);
    expect(isPostSaleQueueName("pós-venda")).toBe(true);
    expect(isPostSaleQueueName("Pos_Venda")).toBe(true);
    expect(isPostSaleQueueName("  Pós   venda ")).toBe(true);
  });

  it("não reconhece outras filas", () => {
    expect(isPostSaleQueueName("Pós Venda 2")).toBe(false);
    expect(isPostSaleQueueName("Pós-vendaa")).toBe(false);
    expect(isPostSaleQueueName("Vendas")).toBe(false);
    expect(isPostSaleQueueName("")).toBe(false);
    expect(isPostSaleQueueName(null)).toBe(false);
    expect(isPostSaleQueueName(undefined)).toBe(false);
  });

  it("normaliza acentos, hífen, underscore e espaços", () => {
    expect(normalizeQueueName("Pós-Venda")).toBe("pos venda");
    expect(normalizeQueueName("POS_VENDA")).toBe("pos venda");
    expect(normalizeQueueName("  Pós   Venda ")).toBe("pos venda");
  });

  it("monta a ação de auditoria com o nome da fila", () => {
    expect(postSaleTransferAuditAction("Pós Venda")).toBe("lead.post_sale_transfer:Pós Venda");
    expect(postSaleTransferAuditAction(null)).toBe("lead.post_sale_transfer");
    expect(postSaleTransferAuditAction("")).toBe("lead.post_sale_transfer");
  });
});
