import { estadoPorStatus } from "../shared/estado-sessao";
import { descreverAparelho } from "../../../../src/features/browser-extension/aparelho";
import { ESTILO } from "./estilo";

// O popup não toca na credencial: lê, troca e desconecta sempre pelo worker (dona da sessão).
type ApiResult = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number; geracao?: string | null };
type Perfil = { nome: string; unidade: string; userId: string; sessionId: string };
type Credencial = { geracao: string; perfil: Perfil | null };

const root = document.querySelector("#root")!;
const aparelho = descreverAparelho(navigator.userAgent);
const escapar = (valor: string) => valor.replace(/[&<>"']/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caractere] ?? caractere);

function render(corpo: string) {
  root.innerHTML = `<style>${ESTILO}</style><main class="painel">${corpo}</main>`;
}

const cabecalho = (selo: string) =>
  `<header class="topo"><span class="marca" aria-hidden="true">A</span><div><h1>AncoraHub Assistant</h1>${selo}</div></header>`;

const REQUEST_TIMEOUT_MS = 15000;

function mensagem<T>(tipo: string, payload?: Record<string, unknown>): Promise<T | null> {
  return new Promise((resolve) => {
    let concluido = false;
    const concluir = (valor: T | null) => {
      if (!concluido) {
        concluido = true;
        window.clearTimeout(limite);
        resolve(valor);
      }
    };
    const limite = window.setTimeout(() => concluir(null), REQUEST_TIMEOUT_MS);
    try {
      chrome.runtime.sendMessage({ type: tipo, payload }, (resposta) => concluir(chrome.runtime.lastError ? null : (resposta as T | null)));
    } catch {
      concluir(null);
    }
  });
}

function request(path: string, method = "GET", body?: unknown) {
  return mensagem<ApiResult>("API_REQUEST", { path, method, body }).then((resposta) => resposta ?? { ok: false, status: 0, body: {} });
}

function botaoDesconectar(credencial: Credencial | null) {
  return credencial ? `<button id="desconectar" class="seco" type="button">Desconectar</button>` : "";
}

/** Desconecta a sessão desta tela: o worker revoga e remove só essa sessão, mesmo se o CRM não responder. */
async function desconectar(credencial: Credencial) {
  const status = document.querySelector("#status");
  const botao = document.querySelector<HTMLButtonElement>("#desconectar");
  if (botao) { botao.disabled = true; botao.textContent = "Desconectando…"; }
  const resultado = await mensagem<{ revogado: boolean; removido: boolean }>("DESCONECTAR", { geracao: credencial.geracao });
  if (resultado && !resultado.revogado && status) status.textContent = "Desconectado neste navegador. Não foi possível revogar no CRM agora; a sessão expira sozinha.";
  showSemSessao("desconectada", null, resultado && !resultado.revogado ? "Desconectado neste navegador. Não foi possível revogar no CRM agora; a sessão expira sozinha." : "");
}

function ligarDesconectar(credencial: Credencial | null) {
  if (!credencial) return;
  document.querySelector("#desconectar")?.addEventListener("click", () => void desconectar(credencial));
}

function showConectada(credencial: Credencial, perfil: Perfil | null) {
  render(`${cabecalho('<span class="selo ok">Conectada</span>')}
    <section class="bloco">
      <p class="rotulo">Conta</p>
      <p class="valor">${escapar(perfil?.nome ?? "Conta conectada")}</p>
      ${perfil ? `<p class="secundario">${escapar(perfil.unidade)}</p>` : ""}
      <p class="secundario">Aparelho: ${escapar(aparelho)}</p>
    </section>
    <p class="secundario">O painel aparece só em conversas de leads atribuídos a você e à sua unidade.</p>
    ${botaoDesconectar(credencial)}
    <p class="status" id="status" role="status"></p>`);
  ligarDesconectar(credencial);
}

/** Sem credencial: "desconectada" (primeira vez ou após desconectar) ou "expirada" (CRM recusou a sessão). */
function showSemSessao(estado: "desconectada" | "expirada", perfil: Perfil | null = null, message = "") {
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
    const troca = await mensagem<{ ok: boolean }>("TROCAR_CODIGO", { code });
    if (troca?.ok) return verificar();
    status.textContent = "Não foi possível conectar. Gere um novo código no CRM.";
  });
}

/** Sem acesso no momento: não mostra nome nem dados; mantém a sessão e deixa desconectar. */
function showIndisponivel(credencial: Credencial) {
  render(`${cabecalho('<span class="selo aviso">Indisponível</span>')}
    <p class="texto">A extensão não está disponível para a sua conta agora. Fale com o seu gestor.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>
    ${botaoDesconectar(credencial)}
    <p class="status" id="status" role="status"></p>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
  ligarDesconectar(credencial);
}

function showLimitada(credencial: Credencial, esperaSegundos: number) {
  render(`${cabecalho('<span class="selo aviso">Muitas consultas</span>')}
    <p class="texto">Aguarde ${esperaSegundos} segundos e tente de novo.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>
    ${botaoDesconectar(credencial)}
    <p class="status" id="status" role="status"></p>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
  ligarDesconectar(credencial);
}

/** Não afirma nada sobre a conexão: sem rede ou com erro do servidor. Deixa desconectar. */
function showFalha(credencial: Credencial) {
  render(`${cabecalho('<span class="selo aviso">Sem verificação</span>')}
    <p class="texto">Não foi possível verificar a conexão agora. Tente de novo em instantes.</p>
    <button id="tentar" class="seco" type="button">Verificar de novo</button>
    ${botaoDesconectar(credencial)}
    <p class="status" id="status" role="status"></p>`);
  document.querySelector("#tentar")!.addEventListener("click", () => verificar());
  ligarDesconectar(credencial);
}

/** Verifica a sessão pelo worker. Só mostra "conectada" com 200 da mesma sessão que o worker tem agora. */
async function verificar(): Promise<void> {
  const credencial = await mensagem<Credencial>("LER_CREDENCIAL");
  if (!credencial) return showSemSessao("desconectada");
  const resposta = await request("/api/extension/session");
  // Se o worker trocou de sessão no meio, a verificação vale de novo, para a sessão atual.
  if (resposta.geracao && resposta.geracao !== credencial.geracao) return verificar();
  const estado = estadoPorStatus(resposta.status, resposta.retryAfter);
  switch (estado.tipo) {
    case "conectada": {
      // O nome só aparece se for da mesma conta e sessão de agora (troca de conta não reaproveita).
      const perfil = credencial.perfil;
      const mesmaSessao = perfil && perfil.userId === resposta.body.userId && perfil.sessionId === resposta.body.sessionId;
      return showConectada(credencial, mesmaSessao ? perfil : null);
    }
    case "expirada":
      // O worker já descartou a sessão ao receber 401.
      return showSemSessao("expirada", credencial.perfil);
    case "indisponivel":
      return showIndisponivel(credencial);
    case "limitada":
      return showLimitada(credencial, estado.esperaSegundos);
    case "falha":
      return showFalha(credencial);
  }
}

void verificar().catch(() => showSemSessao("desconectada"));
