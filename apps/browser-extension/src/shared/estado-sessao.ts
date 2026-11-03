// Como cada resposta da API muda o que a extensão mostra. Usado pelo popup e pelo painel do WhatsApp.
// Regra: só 200 é "conectada". Sem sessão (401) não mostra nada do CRM. Sem acesso (403) não mostra dados.

export type EstadoSessao =
  | { tipo: "conectada" }
  | { tipo: "expirada" }
  | { tipo: "indisponivel" }
  | { tipo: "limitada"; esperaSegundos: number }
  | { tipo: "falha" };

const ESPERA_PADRAO_SEGUNDOS = 60;

export function estadoPorStatus(status: number, retryAfter?: number): EstadoSessao {
  if (status === 200) return { tipo: "conectada" };
  if (status === 401) return { tipo: "expirada" };
  if (status === 403) return { tipo: "indisponivel" };
  if (status === 429) return { tipo: "limitada", esperaSegundos: retryAfter ?? ESPERA_PADRAO_SEGUNDOS };
  // 0 (sem rede), 5xx e qualquer outro: não se afirma nada sobre a conexão.
  return { tipo: "falha" };
}
