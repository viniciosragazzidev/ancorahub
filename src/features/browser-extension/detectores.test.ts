// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  capacidadesDisponiveis,
  localizarTodas,
  type Capacidade,
} from "../../../apps/browser-extension/src/content/detectors";

// O vitest roda na raiz do projeto; import.meta.url não aponta para o arquivo no ambiente jsdom.
const fixture = (nome: string) =>
  readFileSync(join(process.cwd(), "apps/browser-extension/src/content/fixtures", nome), "utf8");

const visivel = () => true;

describe("registro de detectores (fixtures sintéticos)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("localiza todas as capacidades na tela em português", () => {
    document.body.innerHTML = fixture("whatsapp-sintetico-pt.html");
    const achados = localizarTodas(document, { visivel });
    expect(achados.shell.estado).toBe("ok");
    expect(achados.cabecalho.estado).toBe("ok");
    expect(achados.composer.estado).toBe("ok");
    expect(achados.gaveta.estado).toBe("ok");
    expect(achados.barraEsquerda.estado).toBe("ok");
  });

  it("acha a barra da esquerda na marcação do WhatsApp Web real (diagnóstico do piloto, 03/11)", () => {
    // Estrutura sanitizada do diagnóstico: header da barra + seção primária; não há nav com aria-label.
    document.body.innerHTML = `<div data-testid="wa-web-main-screen">
      <header data-testid="chatlist-header" data-tab="2"><div data-testid="navbar-primary-section"><button aria-label="Conversas"></button></div>
      <div data-testid="navbar-footer-section"></div></header>
      <header data-testid="chatlist-header"></header>
      <div id="main" data-testid="conversation-panel-wrapper"><header data-testid="conversation-header"></header>
      <footer><div role="textbox" contenteditable="true" data-testid="conversation-compose-box-input"></div></footer></div>
      <div data-testid="drawer-right"></div></div>`;
    const achados = localizarTodas(document, { visivel });
    expect(achados.barraEsquerda.estado).toBe("ok");
    expect(achados.shell.estado).toBe("ok");
    expect(achados.cabecalho.estado).toBe("ok");
    expect(achados.composer.estado).toBe("ok");
    expect(achados.gaveta.estado).toBe("ok");
  });

  it("usa o aria-label em inglês quando o data-testid não existe", () => {
    document.body.innerHTML = fixture("whatsapp-sintetico-en.html");
    const achados = localizarTodas(document, { visivel });
    expect(achados.composer.estado).toBe("ok");
    expect(achados.barraEsquerda.estado).toBe("ok");
    expect(achados.gaveta.estado).toBe("ausente");
  });

  it("não age quando o alvo é ambíguo (dois compositores)", () => {
    document.body.innerHTML = `${fixture("whatsapp-sintetico-pt.html")}<div data-testid="conversation-compose-box-input"></div>`;
    const achados = localizarTodas(document, { visivel });
    expect(achados.composer.estado).toBe("ambigua");
    expect(achados.shell.estado).toBe("ok");
  });

  it("degrada só a capacidade que falta", () => {
    document.body.innerHTML = fixture("whatsapp-sintetico-pt.html").replace(/<section data-testid="drawer-right"><\/section>/, "");
    const achados = localizarTodas(document, { visivel });
    expect(achados.gaveta.estado).toBe("ausente");
    const disponiveis = capacidadesDisponiveis(achados);
    expect(disponiveis.has("composer")).toBe(true);
    expect(disponiveis.has("gaveta")).toBe(false);
  });

  it("esconde a capacidade quando o alvo não está visível", () => {
    document.body.innerHTML = fixture("whatsapp-sintetico-pt.html");
    const achados = localizarTodas(document, { visivel: (elemento) => elemento.getAttribute("data-testid") !== "drawer-right" });
    expect(achados.gaveta.estado).toBe("oculta");
  });

  it("respeita as capacidades desligadas pelo super admin", () => {
    document.body.innerHTML = fixture("whatsapp-sintetico-pt.html");
    const desligadas = new Set<Capacidade>(["composer"]);
    const achados = localizarTodas(document, { visivel, desligadas });
    expect(achados.composer.estado).toBe("desligada");
    expect(capacidadesDisponiveis(achados).has("composer")).toBe(false);
  });
});
