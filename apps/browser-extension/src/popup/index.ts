import { lerPerfilGuardado, trocarCodigo, type PerfilGuardado } from "../shared/sessao";
import { estadoPorStatus } from "../shared/estado-sessao";
import { avisarMudancaSessao } from "../background/abas";
import { descreverAparelho } from "../../../../src/features/browser-extension/aparelho";
import { ESTILO } from "./estilo";

type ApiResult = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number };

const root = document.querySelector("#root")!;
const aparelho = descreverAparelho(navigator.userAgent);
const escapar = (valor: string) => valor.replace(/[&<>"']/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caractere] ?? caractere);

function render(corpo: string) {
  root.innerHTML = `<style>${ESTILO}</style><main class="painel">${corpo}</main>`;
}

const cabecalho = (selo: string) =>
  `<header class="topo"><span class="marca" aria-hidden="true">A</span><div><h1>AncoraHub Assistant</h1>${selo}</div></header>`;

const REQUEST_TIMEOUT_MS = 15000;

function request(path: string, method = "GET", body?: unknown) {
  return new Promise<ApiResult>((resolve) => {
    let settled = false;
    let timer: number | undefined;
    const finish = (result: ApiResult) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(result);
      }
    };
    try {
      chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method, body } }, (response) => {
        if (chrome.runtime.lastError || !response || typeof response !== "object" || !("ok" in response)) {
          finish({ ok: false, status: 0, body: {} });
          return;
        }
        finish(response as ApiResult);
      });
      timer = window.setTimeout(() => finish({ ok: false, status: 0, body: {} }), REQUEST_TIMEOUT_MS);
    } catch {
      finish({ ok: false, status: 0, body: {} });
    }
  });
}

/** Limpa a credencial e o perfil deste navegador. Não depende do CRM responder. */
async function limparCredencialLocal() {
  await chrome.storage.session.remove(["token", "tokenEm"]).catch(() => undefined);
  await chrome.storage.local.remove("perfil").catch(() => undefined);
}

function showConectada(perfil: PerfilGuardado | null) {
  render(`${cabecalho('<span class="selo ok">Conectada</span>')}
    <section class="bloco">
      <p class="rotulo">Conta</p>
      <p class="valor">${escapar(perfil?.nome ?? "Conta conectada")}</p>
      ${perfil ? `<p class="secundario">${escapar(perfil.unidade)}</p>` : ""}
      <p class="secundario">Aparelho: ${escapar(aparelho)}</p>
    </section>
    <p class="secundario">O painel aparece só em conversas de leads atribuídos a você e à sua unidade.</p>
    <button id="desconectar" class="seco" type="button">Desconectar</button>
    <p class="status" id="status" role="status"></p>`);
  document.querySelector("#desconectar")!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#desconectar")!;
    const status = document.querySelector("#status")!;
    button.disabled = true;
    button.textContent = "Desconectando…";
    // Revoga no CRM enquanto o token ainda existe; a credencial local sai de qualquer forma (B2).
    const revogacao = await request("/api/extension/auth/revoke", "POST");
    await limparCredencialLocal();
    await avisarMudancaSessao();
    showSemSessao("desconectada", null, revogacao.ok ? "" : "Desconectado neste navegador. Não foi possível revogar no CRM agora; a sessão expira sozinha.");
  });
}

/** Sem credencial: "desconectada" (primeira vez ou após desconectar) ou "expirada" (CRM recusou o token). */
function showSemSessao(estado: "desconectada" | "expirada", perfil: PerfilGuardado | null = null, message = "") {
  const selo = estado === "expirada" ? '<span class="selo aviso">Sessão expirada</span>' : '<span class="selo">Desconectada</span>';
  const texto = estado === "expirada"
    ? "Sua conexão com o CRM expirou. Conecte de novo para continuar."
    : "Conecte este navegador à sua conta para ver o contexto do lead no WhatsApp Web.";
  render(`${cabecalho(selo)}
    <p class="texto">${texto}</p>
    ${estado === "expirada" && perfil ? `<p class="secundario">${escapar(perfil.nome)} · ${escapar(perfil.unidade)}</p>` : ""}
    <button id="conectar-crm" class="primario" type="button">Conectar ao CRM</button>
    <div class="separador"><span>ou use o código</span></div>
    <input id="code" placeholder="Código temporário" autocomplete="one-time-code" aria-label="Código temporário">
    <button id="connect" class="seco" type="button">Conectar com código</button>
    <p class="status" id="status" role="status">${escapar(message)}</p>`);
  document.querySelector("#conectar-crm")!.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError);
    window.close();
  });
  document.querySelector("#connect")!.addEventListener("click", async () => {
    const status = document.querySelector("#status")!;
    const code = (document.querySelector("#code") as HTMLInputElement).value.trim();
    if (!code) { status.textContent = "Informe o código gerado no CRM."; return; }
    status.textContent = "Conectando…";
    if (await trocarCodigo(code)) return verificar();
    status.textContent = "Não foi possível conectar. Gere um novo código no CRM.";
  });
}

/** Sem acesso no momento: não mostra nome nem dados, e mantém a credencial (pode voltar a funcionar). */
function showIndisponivel() {
  render(`${cabecalho('<span class="selo aviso">Indisponível</span>')}
    <p class="texto">A extensão não está disponível para a sua conta agora. Fale com o seu gestor.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
}

function showLimitada(esperaSegundos: number) {
  render(`${cabecalho('<span class="selo aviso">Muitas consultas</span>')}
    <p class="texto">Aguarde ${esperaSegundos} segundos e tente de novo.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
}

/** Não afirma nada sobre a conexão: sem rede ou com erro do servidor. */
function showFalha() {
  render(`${cabecalho('<span class="selo aviso">Sem verificação</span>')}
    <p class="texto">Não foi possível verificar a conexão agora. Tente de novo em instantes.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
}

/** Verifica a sessão no CRM. Só mostra "conectada" com 200; a tela muda conforme o status. */
async function verificar() {
  const { token } = await chrome.storage.session.get("token");
  const perfil = await lerPerfilGuardado();
  if (!token) return showSemSessao("desconectada");
  const resposta = await request("/api/extension/session");
  const estado = estadoPorStatus(resposta.status, resposta.retryAfter);
  switch (estado.tipo) {
    case "conectada": {
      // O nome só aparece se for da mesma conta e sessão de agora (troca de conta não reaproveita).
      const mesmaSessao = perfil && perfil.userId === resposta.body.userId && perfil.sessionId === resposta.body.sessionId;
      return showConectada(mesmaSessao ? perfil : null);
    }
    case "expirada":
      // O worker já limpou a credencial ao receber 401; o perfil fica só para mostrar a conta anterior.
      return showSemSessao("expirada", perfil);
    case "indisponivel":
      return showIndisponivel();
    case "limitada":
      return showLimitada(estado.esperaSegundos);
    case "falha":
      return showFalha();
  }
}

void verificar().catch(() => showFalha());
