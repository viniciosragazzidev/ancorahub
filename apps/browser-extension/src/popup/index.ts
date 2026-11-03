import { trocarCodigo } from "../shared/sessao";
import { descreverAparelho } from "../../../../src/features/browser-extension/aparelho";
import { ESTILO } from "./estilo";

type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> };
type Perfil = { nome: string; unidade: string };

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
        finish(response);
      });
      timer = window.setTimeout(() => finish({ ok: false, status: 0, body: {} }), REQUEST_TIMEOUT_MS);
    } catch {
      finish({ ok: false, status: 0, body: {} });
    }
  });
}

async function lerPerfil(): Promise<Perfil | null> {
  const { perfil } = await chrome.storage.local.get("perfil");
  if (!perfil || typeof perfil !== "object") return null;
  const { nome, unidade } = perfil as Record<string, unknown>;
  return typeof nome === "string" && typeof unidade === "string" ? { nome, unidade } : null;
}

function showConectada(perfil: Perfil | null) {
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
    const result = await request("/api/extension/auth/revoke", "POST");
    if (!result.ok) {
      button.disabled = false;
      button.textContent = "Desconectar";
      status.textContent = "Não foi possível desconectar. Tente de novo.";
      return;
    }
    await chrome.storage.session.remove("token").catch(() => undefined);
    await chrome.storage.local.remove("perfil").catch(() => undefined);
    showSemSessao("desconectada");
  });
}

// Sem sessão: "desconectada" (primeira vez ou após desconectar) ou "expirada" (token antigo recusado pelo CRM).
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
    try {
      if (!(await trocarCodigo(code))) throw new Error("INVALID_CODE");
      showConectada(await lerPerfil());
    } catch {
      status.textContent = "Não foi possível conectar. Gere um novo código no CRM.";
    }
  });
}

void (async () => {
  const { token } = await chrome.storage.session.get("token");
  const perfil = await lerPerfil();
  if (!token) return showSemSessao("desconectada");
  const session = await request("/api/extension/session");
  if (session.ok || session.status !== 401) return showConectada(perfil);
  await chrome.storage.session.remove("token").catch(() => undefined);
  showSemSessao("expirada", perfil);
})().catch(() => showSemSessao("desconectada"));
