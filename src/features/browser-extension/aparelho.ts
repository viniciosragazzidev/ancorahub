/** Nome legível do aparelho a partir do user agent, ex.: "Chrome no Windows". Não é identificador: só exibição. */
export function descreverAparelho(userAgent: string): string {
  const ua = userAgent;
  // Ordem importa: Edge, Opera e Chrome também trazem "Safari" no user agent.
  const navegador = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const sistema = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}
