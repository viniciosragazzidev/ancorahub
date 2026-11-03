import { CRM_BASE } from "../config";
import { mensagemConectarValida, remetenteConfiavel } from "./conexao";
import { chamarApiReal, credencialStore } from "./api";
import { avisarAbasWhatsApp } from "./abas";
import { desconectarNoWorker, trocarCodigoNoWorker } from "./troca";
import { obterDeviceId } from "../shared/dispositivo";
import type { Metodo } from "./sessao-token";

const API_BASE = CRM_BASE;

/**
 * Encapsula o `sendResponse` do listener. Quando o remetente encerra o canal
 * (ex.: aba do WhatsApp Web fechada durante o fetch, extensão recarregada), a
 * resposta não pode mais ser entregue. Sem essa proteção, o Chrome registra
 * "A listener indicated an asynchronous response by returning true, but the
 * message channel closed before a response was received".
 */
function createResponder(sendResponse: (value: unknown) => void) {
  let sent = false;
  return (value: unknown) => {
    if (sent) return;
    sent = true;
    try {
      sendResponse(value);
    } catch {
      // Canal encerrado pelo remetente — ignora silenciosamente.
    }
  };
}

/** Método preservado como veio (GET, POST ou PATCH); qualquer outro valor vira GET. */
function metodoDoPedido(valor: unknown): Metodo {
  return valor === "POST" || valor === "PATCH" ? valor : "GET";
}

chrome.runtime.onMessage.addListener((message: { type?: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
  const respond = createResponder(sendResponse);
  if (message.type === "API_REQUEST") {
    void chamarApiReal(String(message.payload?.path ?? ""), metodoDoPedido(message.payload?.method), message.payload?.body)
      .then((resposta) => respond({ ok: resposta.ok, status: resposta.status, body: resposta.body, retryAfter: resposta.retryAfter, geracao: resposta.geracao }))
      .catch(() => respond({ ok: false, status: 0, body: { error: "OFFLINE" }, geracao: null }));
    return true;
  }
  if (message.type === "TROCAR_CODIGO") {
    const perfil = message.payload?.perfil as { nome?: unknown; unidade?: unknown } | undefined;
    const perfilValido = typeof perfil?.nome === "string" && typeof perfil?.unidade === "string" ? { nome: perfil.nome, unidade: perfil.unidade } : undefined;
    void trocarCodigoNoWorker(String(message.payload?.code ?? ""), perfilValido)
      .then((resultado) => respond(resultado))
      .catch(() => respond({ ok: false }));
    return true;
  }
  if (message.type === "LER_CREDENCIAL") {
    void credencialStore.ler()
      .then((credencial) => respond(credencial ? { geracao: credencial.geracao, perfil: credencial.perfil } : null))
      .catch(() => respond(null));
    return true;
  }
  if (message.type === "DESCONECTAR") {
    void desconectarNoWorker(String(message.payload?.geracao ?? ""))
      .then((resultado) => respond(resultado))
      .catch(() => respond({ revogado: false, removido: false }));
    return true;
  }
  if (message.type === "SESSAO_MUDOU") {
    // Pedido de popup ou página: avisa as abas do WhatsApp Web para descartarem a tela.
    void avisarAbasWhatsApp();
    respond({ ok: true });
    return false;
  }
  if (message.type === "OPEN_CRM_LEAD") {
    const leadId = String(message.payload?.leadId ?? "");
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(leadId)) return false;
    try {
      chrome.tabs.create({ url: `${API_BASE}/leads/${encodeURIComponent(leadId)}` });
    } catch {
      respond({ ok: false });
      return false;
    }
    respond({ ok: true });
    return false;
  }
  if (message.type === "OPEN_CRM_CONNECT") {
    void (async () => {
      const deviceId = await obterDeviceId();
      chrome.tabs.create({ url: `${API_BASE}/extensao/conectar?ext=${encodeURIComponent(chrome.runtime.id)}&device=${encodeURIComponent(deviceId)}` });
    })();
    respond({ ok: true });
    return false;
  }
  return false;
});

// Só a página de conexão do CRM fala por aqui. Remetente ou formato fora do esperado é recusado sem trocar nada.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const respond = createResponder(sendResponse);
  if (!remetenteConfiavel(sender, API_BASE)) {
    respond({ ok: false, reason: "SENDER_REFUSED" });
    return false;
  }
  const valida = mensagemConectarValida(message);
  if (!valida) {
    respond({ ok: false, reason: "BAD_MESSAGE" });
    return false;
  }
  void trocarCodigoNoWorker(valida.code, valida.perfil)
    .then((resultado) => respond({ ok: resultado.ok, reason: resultado.ok ? undefined : "INVALID_CODE" }))
    .catch(() => respond({ ok: false, reason: "OFFLINE" }));
  return true;
});
