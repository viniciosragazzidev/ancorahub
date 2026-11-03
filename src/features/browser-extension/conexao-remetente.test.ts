import { describe, expect, it } from "vitest";
import {
  mensagemConectarValida,
  remetenteConfiavel,
} from "../../../apps/browser-extension/src/background/conexao";

const CRM = "https://crm.ancorasaude.cloud";
const PAGINA = `${CRM}/extensao/conectar?ext=abcdefghijklmnopabcdefghijklmnop&device=1f2e3d4c-0000-4000-8000-000000000000`;

describe("remetente das mensagens externas", () => {
  it("aceita a página de conexão do CRM na origem exata", () => {
    expect(remetenteConfiavel({ url: PAGINA }, CRM)).toBe(true);
  });

  it("recusa outra extensão (traz sender.id)", () => {
    expect(remetenteConfiavel({ id: "outraextensao", url: PAGINA }, CRM)).toBe(false);
  });

  it("recusa outra origem, inclusive subdomínio e http", () => {
    expect(remetenteConfiavel({ url: "https://evil.example/extensao/conectar" }, CRM)).toBe(false);
    expect(remetenteConfiavel({ url: "https://crm.ancorasaude.cloud.evil.example/extensao/conectar" }, CRM)).toBe(false);
    expect(remetenteConfiavel({ url: "http://crm.ancorasaude.cloud/extensao/conectar" }, CRM)).toBe(false);
  });

  it("recusa outro caminho do mesmo CRM", () => {
    expect(remetenteConfiavel({ url: `${CRM}/extensao/conectar/extra` }, CRM)).toBe(false);
    expect(remetenteConfiavel({ url: `${CRM}/dashboard` }, CRM)).toBe(false);
  });

  it("recusa remetente sem URL ou com URL inválida", () => {
    expect(remetenteConfiavel({}, CRM)).toBe(false);
    expect(remetenteConfiavel({ url: "não é url" }, CRM)).toBe(false);
  });
});

describe("formato da mensagem de conexão", () => {
  it("aceita o tipo exato com código no formato esperado", () => {
    expect(mensagemConectarValida({ type: "CONECTAR_EXTENSAO", code: "Abc123_-xyz9" })).toEqual({ code: "Abc123_-xyz9" });
  });

  it("recusa tipo errado, código curto, código com espaço ou ausente", () => {
    expect(mensagemConectarValida({ type: "OUTRO", code: "Abc123_-xyz9" })).toBeNull();
    expect(mensagemConectarValida({ type: "CONECTAR_EXTENSAO", code: "curto" })).toBeNull();
    expect(mensagemConectarValida({ type: "CONECTAR_EXTENSAO", code: "tem espaco aqui" })).toBeNull();
    expect(mensagemConectarValida({ type: "CONECTAR_EXTENSAO" })).toBeNull();
    expect(mensagemConectarValida(null)).toBeNull();
  });
});
