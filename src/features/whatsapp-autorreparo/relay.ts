import "server-only";

/**
 * Cliente mínimo do relay WAHA para o auto-reparo. Só duas chamadas:
 * - consultarStatusRelay: GET (somente leitura).
 * - iniciarSessaoRelay: POST /start, que nunca apaga a sessão. Não existe aqui nenhuma chamada a
 *   recover ou delete: essas apagam a autenticação salva e obrigam novo QR.
 */

export type ConsultaRelay = { ok: true; status: string | null } | { ok: false; erro: string };
export type InicioRelay = { ok: true; status: string | null } | { ok: false; erro: string; rotaAusente?: boolean };

function configurarRelay() {
  const base = process.env.VPS_API_URL?.trim().replace(/\/$/, "");
  const token = (
    process.env.WHATSAPP_API_INTERNAL_TOKEN ||
    process.env.VPS_INTERNAL_API_TOKEN ||
    process.env.VPS_API_TOKEN ||
    process.env.WAHA_RELAY_SHARED_SECRET
  )?.trim();
  return { base, token };
}

async function chamar(caminho: string, metodo: "GET" | "POST") {
  const { base, token } = configurarRelay();
  if (!base) return { resposta: null, erro: "VPS_API_URL não configurada" } as const;
  try {
    const resposta = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(12_000),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { status?: unknown; error?: unknown };
    return { resposta: { http: resposta.status, corpo }, erro: null } as const;
  } catch (error) {
    return { resposta: null, erro: error instanceof Error ? error.message.slice(0, 120) : "falha de rede" } as const;
  }
}

export async function consultarStatusRelay(sessionName: string): Promise<ConsultaRelay> {
  const caminho = `/internal/waha/connections/${encodeURIComponent(sessionName)}/status`;
  const { resposta, erro } = await chamar(caminho, "GET");
  if (!resposta) return { ok: false, erro: erro ?? "sem resposta" };
  if (resposta.http !== 200) return { ok: false, erro: `HTTP ${resposta.http}` };
  return { ok: true, status: typeof resposta.corpo.status === "string" ? resposta.corpo.status : null };
}

export async function iniciarSessaoRelay(sessionName: string): Promise<InicioRelay> {
  const caminho = `/internal/waha/connections/${encodeURIComponent(sessionName)}/start`;
  const { resposta, erro } = await chamar(caminho, "POST");
  if (!resposta) return { ok: false, erro: erro ?? "sem resposta" };
  // 404: o relay ainda não tem a rota de start (ela precisa ser publicada no corretop-infra).
  if (resposta.http === 404) return { ok: false, erro: "rota de start ausente no relay", rotaAusente: true };
  if (resposta.http !== 200) return { ok: false, erro: `HTTP ${resposta.http}` };
  return { ok: true, status: typeof resposta.corpo.status === "string" ? resposta.corpo.status : null };
}
