import { describe, expect, it } from "vitest";

import { getDirectorFacingMetaDeliveryFailure } from "./meta-delivery-failure";

describe("getDirectorFacingMetaDeliveryFailure", () => {
  it("explica com segurança o bloqueio de cobrança da WABA", () => {
    expect(getDirectorFacingMetaDeliveryFailure("131042")).toEqual({
      code: "131042",
      title: "Cobrança da conta WhatsApp pendente",
      message:
        "A Meta bloqueou a entrega porque a conta WhatsApp Business está com uma pendência de cobrança ou elegibilidade. Revise o método de pagamento vinculado à WABA no Meta Business Suite.",
    });
  });
});
