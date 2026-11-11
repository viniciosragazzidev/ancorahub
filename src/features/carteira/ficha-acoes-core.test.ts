import { describe, expect, it } from "vitest";

import { fichaAcoesCorretor } from "./ficha-acoes-core";

describe("ações da ficha do corretor", () => {
  it("flag desligada não aplica regra da carteira", () => {
    expect(fichaAcoesCorretor({ walletOn: false, nextState: "upcoming", canConversas: true })).toBeNull();
  });

  it("cliente da carteira: documentos, conversa e vendas", () => {
    expect(fichaAcoesCorretor({ walletOn: true, nextState: "none", canConversas: true })).toEqual({ documents: true, conversation: true, saleLinks: true });
  });

  it("sem permissão de conversas, o link de conversa some e o resto segue", () => {
    expect(fichaAcoesCorretor({ walletOn: true, nextState: "overdue", canConversas: false })).toEqual({ documents: true, conversation: false, saleLinks: true });
  });

  it("lead transferido: ficha só de leitura, sem documentos nem links", () => {
    expect(fichaAcoesCorretor({ walletOn: true, nextState: "not_owner", canConversas: true })).toEqual({ documents: false, conversation: false, saleLinks: false });
  });

  it("estado de dono desconhecido (falha) não libera ações", () => {
    expect(fichaAcoesCorretor({ walletOn: true, nextState: null, canConversas: true })).toEqual({ documents: false, conversation: false, saleLinks: false });
    expect(fichaAcoesCorretor({ walletOn: true, nextState: undefined, canConversas: true })).toEqual({ documents: false, conversation: false, saleLinks: false });
  });
});
