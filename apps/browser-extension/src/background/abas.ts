// Avisa as abas do WhatsApp Web quando a sessão muda (troca de conta, revogação, expiração).
// O conteúdo limpa o que estava na tela e refaz a consulta do lead com a sessão nova.
export async function avisarAbasWhatsApp() {
  const abas = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" }).catch(() => []);
  for (const aba of abas) {
    if (aba.id !== undefined) chrome.tabs.sendMessage(aba.id, { type: "SESSAO_MUDOU" }, () => void chrome.runtime.lastError);
  }
}

/** Do service worker avisa direto; de popup ou página, pede ao worker que avise. */
export function avisarMudancaSessao() {
  if (typeof window === "undefined") return avisarAbasWhatsApp();
  chrome.runtime.sendMessage({ type: "SESSAO_MUDOU" }, () => void chrome.runtime.lastError);
  return Promise.resolve();
}
