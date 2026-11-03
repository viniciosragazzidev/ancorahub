export const MENSAGEM_CONECTAR = "CONECTAR_EXTENSAO";
const CAMINHO_CONEXAO = "/extensao/conectar";
const FORMATO_CODIGO = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Só a página de conexão do CRM, na origem exata, pode falar com a extensão por mensagem externa.
 * Outra extensão traz `id`; um site qualquer tem outra origem; um subcaminho não é a página.
 */
export function remetenteConfiavel(sender: { id?: string; url?: string }, crmBase: string): boolean {
  if (sender.id !== undefined || !sender.url) return false;
  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return false;
  }
  return url.origin === new URL(crmBase).origin && url.pathname === CAMINHO_CONEXAO;
}

/** Mensagem válida: tipo exato e código com formato esperado. Qualquer outra coisa é recusada. */
export function mensagemConectarValida(mensagem: unknown): { code: string } | null {
  if (!mensagem || typeof mensagem !== "object") return null;
  const { type, code } = mensagem as Record<string, unknown>;
  if (type !== MENSAGEM_CONECTAR || typeof code !== "string" || !FORMATO_CODIGO.test(code)) return null;
  return { code };
}
