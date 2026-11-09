/**
 * Abre o app do WhatsApp (09/11). Nenhum link abre direto na tela inicial: o celular volta para a última tela
 * usada (às vezes a conversa com o número da empresa). Por isso o roteiro de presença avisa, antes de abrir, para
 * voltar até a tela Conversas e tocar nos 3 pontinhos.
 * Correção de 09/11 (tarde): o link sem `send` (`whatsapp://` e o intent com host vazio) não abria o app no Android:
 * o WhatsApp só atende o endereço `whatsapp://send`. Sem número nem texto, ele só abre o app.
 *
 * - Android: link de intent pelo pacote, para o `whatsapp://send`. Tenta o WhatsApp comum; se não estiver instalado,
 *   o Chrome segue o `browser_fallback_url`, que só muda o `#` desta página, e aí tentamos o WhatsApp Business.
 * - iPhone e demais: `whatsapp://send`.
 */
export type WhatsAppAppPlatform = "android" | "ios" | "other";

export const WHATSAPP_PACKAGE = "com.whatsapp";
export const WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";
/** Marcas no `#` da página que o fallback do Android usa para seguir para o próximo passo. */
export const WHATSAPP_BUSINESS_HASH = "#abrir-whatsapp-business";
export const WHATSAPP_MISSING_HASH = "#whatsapp-nao-encontrado";

export function detectWhatsAppPlatform(userAgent: string): WhatsAppAppPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "other";
}

/** Link que só abre o app. `fallbackUrl` (só Android) é para onde o Chrome vai se o pacote não existir. */
export function whatsappAppUrl(platform: WhatsAppAppPlatform, options: { pkg?: string; fallbackUrl?: string } = {}): string {
  if (platform !== "android") return "whatsapp://send";
  const fallback = options.fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(options.fallbackUrl)};` : "";
  return `intent://send#Intent;scheme=whatsapp;package=${options.pkg ?? WHATSAPP_PACKAGE};${fallback}end`;
}

function pageWithHash(hash: string) {
  return `${window.location.href.split("#")[0]}${hash}`;
}

function clearHash() {
  window.history.replaceState(window.history.state, "", window.location.href.split("#")[0]);
}

/**
 * Abre o WhatsApp no celular, no contexto atual (sem popup). No Android, se nenhum dos dois apps existir,
 * chama `onMissing`. Devolve uma função que desliga a escuta do `#`.
 */
export function openWhatsAppApp(options: { onMissing?: () => void } = {}): () => void {
  const platform = detectWhatsAppPlatform(window.navigator.userAgent);
  if (platform !== "android") {
    window.open(whatsappAppUrl(platform), "_self");
    return () => undefined;
  }
  function onHashChange() {
    if (window.location.hash === WHATSAPP_BUSINESS_HASH) {
      clearHash();
      window.location.href = whatsappAppUrl("android", { pkg: WHATSAPP_BUSINESS_PACKAGE, fallbackUrl: pageWithHash(WHATSAPP_MISSING_HASH) });
      return;
    }
    if (window.location.hash === WHATSAPP_MISSING_HASH) {
      clearHash();
      window.removeEventListener("hashchange", onHashChange);
      options.onMissing?.();
    }
  }
  window.addEventListener("hashchange", onHashChange);
  window.location.href = whatsappAppUrl("android", { pkg: WHATSAPP_PACKAGE, fallbackUrl: pageWithHash(WHATSAPP_BUSINESS_HASH) });
  const stop = () => window.removeEventListener("hashchange", onHashChange);
  // Depois de um tempo o app já abriu (ou não): a escuta não fica pendurada.
  window.setTimeout(stop, 60_000);
  return stop;
}
