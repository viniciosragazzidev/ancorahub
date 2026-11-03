import { CRM_BASE } from "../config";
import { mensagemConectarValida, remetenteConfiavel } from "./conexao";
import { chamarApiReal, credencialStore } from "./api";
import { avisarAbasWhatsApp } from "./abas";
import { desconectarNoWorker, trocarCodigoNoWorker } from "./troca";
import { obterDeviceId } from "../shared/dispositivo";
import type { Metodo } from "./sessao-token";
import {
  contentNoticeType, inboxHeartbeatDue, INBOX_ALARM_MINUTES, INBOX_OFFER_WARNING_ALARM, INBOX_POLL_ALARM,
  INBOX_POLL_MS, INBOX_PORT_NAME, INBOX_RETRY_ALARM, INBOX_STATE_KEY, LAST_MINUTE_MS, notificationCopy,
  notificationId, offerIdFromNotification, OFFERS_REFRESH_MS, readInboxState, reconcileActiveOffers,
  handleInboxNotModified, reconcileInboxResponse, retryAfterTimestamp, type ActiveOffer, type InboxItem, type InboxState,
} from "./inbox-state";

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

const CHAVE_ACAO_PENDENTE = "ancorahubPendingWhatsAppAction";
const CHAVE_SOM = "ancorahubAlertSoundEnabled";
const WA_URL = "https://web.whatsapp.com/";
const ICON_URL = chrome.runtime.getURL("icons/ancorahub-128.png");
const abasComWhatsApp = new Set<ChromePort>();
let inboxEmVoo: Promise<void> | null = null;
let ofertasEmVoo: Promise<InboxState> | null = null;
let timerFecharOffscreen: ReturnType<typeof setTimeout> | null = null;
let ultimoPulsoInbox = 0;
let ultimaConsultaInbox = 0;
let ofertasForcadasPendentes = false;

async function lerEstadoInbox(generation: string) {
  const saved = await chrome.storage.local.get(INBOX_STATE_KEY);
  const raw = saved[INBOX_STATE_KEY];
  return { state: readInboxState(raw, generation), sameGeneration: Boolean(raw && typeof raw === "object" && (raw as { generation?: unknown }).generation === generation) };
}

async function gravarEstadoInbox(state: InboxState) {
  await chrome.storage.local.set({ [INBOX_STATE_KEY]: state });
}

async function atualizarBadge(count: number) {
  await chrome.action.setBadgeText({ text: count > 99 ? "99+" : count > 0 ? String(count) : "" }).catch(() => undefined);
  await chrome.action.setBadgeBackgroundColor({ color: "#b42318" }).catch(() => undefined);
  await chrome.action.setBadgeTextColor({ color: "#ffffff" }).catch(() => undefined);
}

async function tocarSomOpcional() {
  const saved = await chrome.storage.local.get(CHAVE_SOM).catch((): Record<string, unknown> => ({}));
  if (saved[CHAVE_SOM] !== true) return;
  try {
    if (!await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.createDocument({ url: "offscreen/audio.html", reasons: ["AUDIO_PLAYBACK"], justification: "Tocar o aviso opcional de uma oferta do CRM." });
    }
    chrome.runtime.sendMessage({ target: "offscreen", type: "PLAY_ALERT_SOUND" }, () => void chrome.runtime.lastError);
    if (timerFecharOffscreen) clearTimeout(timerFecharOffscreen);
    timerFecharOffscreen = setTimeout(() => { void chrome.offscreen.closeDocument().catch(() => undefined); }, 3500);
  } catch {
    // Som opcional: falhas do documento offscreen nunca interrompem alertas ou o WhatsApp.
  }
}

async function mostrarAvisoNasAbas(aviso: { id: string; tipo: "offer" | "last-minute" | "update"; offerId?: string }) {
  const abas = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" }).catch(() => []);
  for (const aba of abas) {
    if (aba.id !== undefined) chrome.tabs.sendMessage(aba.id, { type: "SHOW_INBOX_NOTICE", payload: { aviso } }, () => void chrome.runtime.lastError);
  }
}

async function emitirAlerta(type: string, id: string, offerId?: string) {
  const copy = notificationCopy(type);
  const idNotificacao = notificationId({ id, type });
  await chrome.notifications.create(idNotificacao, { type: "basic", iconUrl: ICON_URL, title: copy.title, message: copy.message, priority: 2 }).catch(() => undefined);
  await tocarSomOpcional();
  await mostrarAvisoNasAbas({ id: idNotificacao, tipo: contentNoticeType(type), ...(offerId ? { offerId } : {}) });
}

async function retry(state: InboxState, retryAfter: number | undefined) {
  const retryAfterAt = retryAfterTimestamp(retryAfter, Date.now());
  const next = { ...state, retryAfterAt };
  await gravarEstadoInbox(next);
  chrome.alarms.create(INBOX_RETRY_ALARM, { when: retryAfterAt });
  return next;
}

function validarOfertas(body: Record<string, unknown>): ActiveOffer[] | null {
  if (!Array.isArray(body.offers)) return null;
  return body.offers.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const offer = value as Record<string, unknown>;
    if (typeof offer.id !== "string" || typeof offer.expiresAt !== "string" || !Number.isFinite(Date.parse(offer.expiresAt))) return [];
    return [{ id: offer.id, expiresAt: offer.expiresAt }];
  });
}

async function atualizarOfertas(generation: string, state: InboxState): Promise<InboxState> {
  if (ofertasEmVoo) return ofertasEmVoo;
  if (state.retryAfterAt > Date.now()) {
    chrome.alarms.create(INBOX_RETRY_ALARM, { when: state.retryAfterAt });
    return state;
  }
  const promise = (async () => {
    const resposta = await chamarApiReal("/api/extension/offers", "GET");
    const atual = await credencialStore.ler();
    if (resposta.geracao !== generation || atual?.geracao !== generation) return state;
    if (resposta.status === 429) return retry(state, resposta.retryAfter);
    if (resposta.status === 401 || resposta.status === 403) {
      const cleared = resposta.status === 401
        ? { ...readInboxState(null, generation), lastOffersSyncAt: Date.now() }
        : { ...state, activeOffers: [], warnedOfferIds: [], lastOffersSyncAt: Date.now(), retryAfterAt: 0 };
      if (resposta.status === 401) await chrome.storage.local.remove(INBOX_STATE_KEY);
      else await gravarEstadoInbox(cleared);
      await chrome.alarms.clear(INBOX_RETRY_ALARM);
      await chrome.alarms.clear(INBOX_OFFER_WARNING_ALARM);
      await atualizarBadge(0);
      return cleared;
    }
    if (!resposta.ok) return resposta.retryAfter ? retry(state, resposta.retryAfter) : state;
    const ofertas = validarOfertas(resposta.body);
    if (!ofertas) return state;
    const reconciliado = reconcileActiveOffers(state, ofertas, Date.now());
    if (!reconciliado) return state;
    const proximo = { ...reconciliado.state, retryAfterAt: 0 };
    await gravarEstadoInbox(proximo);
    await chrome.alarms.clear(INBOX_RETRY_ALARM);
    await atualizarBadge(proximo.activeOffers.length);
    const avisosDeUltimoMinuto = new Set(reconciliado.lastMinute.map((offer) => offer.id));
    for (const offer of reconciliado.newOffers) {
      if (!avisosDeUltimoMinuto.has(offer.id)) await emitirAlerta("lead_offer_pending", offer.id, offer.id);
    }
    for (const offer of reconciliado.lastMinute) await emitirAlerta("offer_last_minute", offer.id, offer.id);
    const proximoAviso = proximo.activeOffers
      .filter((offer) => !proximo.warnedOfferIds.includes(offer.id))
      .map((offer) => Date.parse(offer.expiresAt) - LAST_MINUTE_MS)
      .sort((left, right) => left - right)[0];
    if (proximoAviso !== undefined) chrome.alarms.create(INBOX_OFFER_WARNING_ALARM, { when: Math.max(Date.now() + 1500, proximoAviso) });
    else await chrome.alarms.clear(INBOX_OFFER_WARNING_ALARM);
    return proximo;
  })();
  ofertasEmVoo = promise;
  try { return await promise; }
  finally { if (ofertasEmVoo === promise) ofertasEmVoo = null; }
}

async function sincronizarInbox(forcarAtualizacaoOfertas = false) {
  if (inboxEmVoo) {
    if (forcarAtualizacaoOfertas) ofertasForcadasPendentes = true;
    return inboxEmVoo;
  }
  const forcarOfertasNestaRodada = forcarAtualizacaoOfertas || ofertasForcadasPendentes;
  ofertasForcadasPendentes = false;
  let adiarForcaAteProximoPulso = false;
  inboxEmVoo = (async () => {
    const credencial = await credencialStore.ler();
    if (!credencial) {
      await chrome.storage.local.remove(INBOX_STATE_KEY).catch(() => undefined);
      await chrome.alarms.clear(INBOX_RETRY_ALARM);
      await chrome.alarms.clear(INBOX_OFFER_WARNING_ALARM);
      await atualizarBadge(0);
      return;
    }
    const loaded = await lerEstadoInbox(credencial.geracao);
    let state = loaded.state;
    const now = Date.now();
    if (state.retryAfterAt > now) {
      if (forcarOfertasNestaRodada) { ofertasForcadasPendentes = true; adiarForcaAteProximoPulso = true; }
      chrome.alarms.create(INBOX_RETRY_ALARM, { when: state.retryAfterAt });
      return;
    }
    if (!inboxHeartbeatDue(ultimaConsultaInbox, now)) {
      if (forcarOfertasNestaRodada) { ofertasForcadasPendentes = true; adiarForcaAteProximoPulso = true; }
      return;
    }
    ultimaConsultaInbox = now;
    const path = `/api/extension/inbox${state.cursor ? `?cursor=${encodeURIComponent(state.cursor)}` : ""}`;
    const resposta = await chamarApiReal(path, "GET");
    const atual = await credencialStore.ler();
    if (resposta.geracao !== credencial.geracao || atual?.geracao !== credencial.geracao) {
      if (forcarOfertasNestaRodada) { ofertasForcadasPendentes = true; adiarForcaAteProximoPulso = true; }
      return;
    }
    if (resposta.status === 429) {
      await retry(state, resposta.retryAfter);
      if (forcarOfertasNestaRodada) { ofertasForcadasPendentes = true; adiarForcaAteProximoPulso = true; }
      return;
    }
    if (resposta.status === 304) {
      await chrome.alarms.clear(INBOX_RETRY_ALARM);
      if (state.retryAfterAt !== 0) {
        state = { ...state, retryAfterAt: 0 };
        await gravarEstadoInbox(state);
      }
      const notModified = handleInboxNotModified(state, now);
      if (forcarOfertasNestaRodada || notModified.refreshOffers) {
        const atualizadas = await atualizarOfertas(credencial.geracao, notModified.state);
        if (forcarOfertasNestaRodada && atualizadas.lastOffersSyncAt < now) {
          ofertasForcadasPendentes = true;
          adiarForcaAteProximoPulso = true;
        }
      }
      return;
    }
    if (!resposta.ok) {
      if (resposta.status === 401) {
        await chrome.storage.local.remove(INBOX_STATE_KEY);
        await atualizarBadge(0);
        await chrome.alarms.clear(INBOX_RETRY_ALARM);
        await chrome.alarms.clear(INBOX_OFFER_WARNING_ALARM);
      }
      else if (resposta.status === 403) {
        const semOfertas = { ...state, activeOffers: [], warnedOfferIds: [], lastOffersSyncAt: Date.now(), retryAfterAt: 0 };
        await gravarEstadoInbox(semOfertas);
        await atualizarBadge(0);
        await chrome.alarms.clear(INBOX_OFFER_WARNING_ALARM);
      }
      else if (resposta.retryAfter) await retry(state, resposta.retryAfter);
      if (forcarOfertasNestaRodada && resposta.status !== 401 && resposta.status !== 403) {
        ofertasForcadasPendentes = true;
        adiarForcaAteProximoPulso = true;
      }
      return;
    }
    const batch = reconcileInboxResponse(loaded.sameGeneration ? state : { ...state, generation: "" }, credencial.geracao, resposta.body);
    if (!batch) return;
    state = { ...batch.state, retryAfterAt: 0 };
    await gravarEstadoInbox(state);
    await chrome.alarms.clear(INBOX_RETRY_ALARM);
    for (const notice of batch.notices) await emitirAlerta(notice.type, notice.id);
    const offersChanged = batch.offerEvents.some((item) => !state.activeOffers.some((offer) => offer.id === item.id));
    if (forcarOfertasNestaRodada || offersChanged || now - state.lastOffersSyncAt >= OFFERS_REFRESH_MS) {
      const atualizadas = await atualizarOfertas(credencial.geracao, state);
      if (forcarOfertasNestaRodada && atualizadas.lastOffersSyncAt < now) {
        ofertasForcadasPendentes = true;
        adiarForcaAteProximoPulso = true;
      }
    }
  })().finally(() => {
    const repetirForca = ofertasForcadasPendentes && !adiarForcaAteProximoPulso;
    inboxEmVoo = null;
    if (repetirForca) void sincronizarInbox(true);
  });
  return inboxEmVoo;
}

function ativarAlarmeDeInbox() {
  void chrome.alarms.create(INBOX_POLL_ALARM, { periodInMinutes: INBOX_ALARM_MINUTES });
}

function iniciarVigiliaWhatsApp() {
  void chrome.alarms.clear(INBOX_POLL_ALARM);
  if (abasComWhatsApp.size !== 1) return;
  ultimoPulsoInbox = Date.now();
  void sincronizarInbox();
}

function pararVigiliaWhatsApp() {
  if (abasComWhatsApp.size > 0) return;
  ultimoPulsoInbox = 0;
  ativarAlarmeDeInbox();
}

function urlReservaValida(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === "https://web.whatsapp.com" && url.pathname === "/send"
      && /^\d{8,16}$/.test(url.searchParams.get("phone") ?? "") && (url.searchParams.get("text")?.length ?? 0) <= 2000;
  } catch { return false; }
}

async function enviarAcaoAba(tabId: number, action: { type: string; payload?: Record<string, unknown> }) {
  return new Promise<boolean>((resolve) => {
    let concluido = false;
    const timer = setTimeout(() => { if (!concluido) { concluido = true; resolve(false); } }, 5000);
    chrome.tabs.sendMessage(tabId, action, (response) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(timer);
      const reply = response as { ok?: boolean } | undefined;
      resolve(!chrome.runtime.lastError && reply?.ok === true);
    });
  });
}

async function focarWhatsAppEAbrir(action: { type: string; payload?: Record<string, unknown> }) {
  const pending = { ...action, createdAt: Date.now() };
  await chrome.storage.local.set({ [CHAVE_ACAO_PENDENTE]: pending });
  const abas = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" }).catch(() => []);
  const aba = abas.find((item) => item.id !== undefined);
  if (aba?.id === undefined) {
    await chrome.tabs.create({ url: WA_URL, active: true });
    return;
  }
  if (aba.windowId !== undefined) await chrome.windows.update(aba.windowId, { focused: true }).catch(() => undefined);
  await chrome.tabs.update(aba.id, { active: true }).catch(() => undefined);
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    if (await enviarAcaoAba(aba.id, action)) {
      await chrome.storage.local.remove(CHAVE_ACAO_PENDENTE);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
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
  if (message.type === "WHATSAPP_READY") {
    void (async () => {
      const saved = await chrome.storage.local.get(CHAVE_ACAO_PENDENTE);
      const pending = saved[CHAVE_ACAO_PENDENTE] as { type?: unknown; payload?: Record<string, unknown>; createdAt?: unknown } | undefined;
      if (!pending || typeof pending.type !== "string" || typeof pending.createdAt !== "number" || Date.now() - pending.createdAt > 10 * 60_000
        || !["OPEN_EXTENSION_OFFERS", "SHOW_INBOX_NOTICE"].includes(pending.type)) {
        await chrome.storage.local.remove(CHAVE_ACAO_PENDENTE);
        respond(null);
        return;
      }
      await chrome.storage.local.remove(CHAVE_ACAO_PENDENTE);
      respond({ type: pending.type, payload: pending.payload });
    })().catch(() => respond(null));
    return true;
  }
  if (message.type === "LER_SOM_ALERTAS") {
    void chrome.storage.local.get(CHAVE_SOM).then((saved) => respond({ enabled: saved[CHAVE_SOM] === true })).catch(() => respond({ enabled: false }));
    return true;
  }
  if (message.type === "DEFINIR_SOM_ALERTAS") {
    const enabled = message.payload?.enabled === true;
    void chrome.storage.local.set({ [CHAVE_SOM]: enabled }).then(() => respond({ ok: true, enabled })).catch(() => respond({ ok: false }));
    return true;
  }
  if (message.type === "OPEN_CRM_NOTIFICATIONS") {
    void chrome.tabs.create({ url: `${API_BASE}/notificacoes`, active: true }).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
    return true;
  }
  if (message.type === "OPEN_WHATSAPP_FALLBACK") {
    const url = message.payload?.url;
    if (!urlReservaValida(url)) { respond({ ok: false }); return false; }
    void chrome.tabs.create({ url, active: true }).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
    return true;
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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== INBOX_PORT_NAME) return;
  abasComWhatsApp.add(port);
  iniciarVigiliaWhatsApp();
  port.onMessage.addListener((message) => {
    if (message.type !== "POLL_INBOX" || !inboxHeartbeatDue(ultimoPulsoInbox, Date.now())) return;
    ultimoPulsoInbox = Date.now();
    void sincronizarInbox();
  });
  port.onDisconnect.addListener(() => {
    abasComWhatsApp.delete(port);
    pararVigiliaWhatsApp();
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === INBOX_POLL_ALARM || alarm.name === INBOX_RETRY_ALARM) {
    if (alarm.name === INBOX_POLL_ALARM && abasComWhatsApp.size > 0) return;
    void sincronizarInbox();
    return;
  }
  if (alarm.name === INBOX_OFFER_WARNING_ALARM) {
    void sincronizarInbox(true);
  }
});

chrome.notifications.onClicked.addListener((idNotificacao) => {
  void (async () => {
    const oferta = idNotificacao.startsWith("ancora-lead_offer_pending-") || idNotificacao.startsWith("ancora-offer_last_minute-");
    let offerId: string | undefined;
    if (oferta) {
      const credencial = await credencialStore.ler();
      if (credencial) {
        const { state } = await lerEstadoInbox(credencial.geracao);
        offerId = offerIdFromNotification(state, idNotificacao);
      }
    }
    const action = oferta
      ? { type: "OPEN_EXTENSION_OFFERS", payload: offerId ? { offerId } : undefined }
      : { type: "SHOW_INBOX_NOTICE", payload: { aviso: { id: idNotificacao, tipo: "update" } } };
    await focarWhatsAppEAbrir(action);
  })().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(ativarAlarmeDeInbox);
chrome.runtime.onInstalled.addListener(ativarAlarmeDeInbox);
ativarAlarmeDeInbox();
