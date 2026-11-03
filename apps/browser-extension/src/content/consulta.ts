import { estadoDoResolve } from "../shared/lead-ampliado";
import { estadoPorStatus } from "../shared/estado-sessao";
import type { EstadoGaveta } from "../shared/types";
import type { SeloCabecalho } from "./painel";

export type ApiResult = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number };
export type EstadoSessaoConteudo = "ativa" | "sem-sessao" | "desconhecida";
export type Conversa = { phone?: string } | null;

// Sessão é conferida no máximo a cada 5 minutos; falha de rede espera 5 segundos antes de tentar de novo.
export const INTERVALO_SESSAO_MS = 5 * 60_000;
export const PAUSA_FALHA_MS = 5_000;

export type DependenciasConsulta = {
  pronto(): boolean;
  conversa(): Promise<Conversa>;
  requisitar(path: string, method: "GET" | "POST", body?: unknown): Promise<ApiResult>;
  mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null): void;
  ocultar(): void;
  aoEstadoSessao(estado: EstadoSessaoConteudo): void;
  agora(): number;
};

/**
 * Consulta do lead na conversa aberta. Regras de privacidade e reconexão:
 * - sem sessão (401) nada do CRM fica na tela; a gaveta mostra só "Conectar ao CRM";
 * - 403 mostra "indisponível" sem dados; 429 pausa pelo Retry-After; falha de rede pausa curto;
 * - invalidar() (troca de conta, revogação, expiração) descarta a tela e cancela consultas em voo;
 * - depois de reconectar, a mesma conversa é consultada de novo (não reaproveita a resposta antiga).
 */
export function criarConsulta(deps: DependenciasConsulta) {
  let sessao: { estado: EstadoSessaoConteudo; em: number } | null = null;
  let pausaAte = 0;
  let lastPhone = "";
  let lastEstado: { estado: EstadoGaveta; selo: SeloCabecalho | null } | null = null;
  let versao = 0;

  function invalidar() {
    versao++;
    lastPhone = "";
    lastEstado = null;
    pausaAte = 0;
    sessao = null;
  }

  function mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null) {
    lastEstado = { estado, selo };
    deps.mostrar(estado, selo);
  }

  async function estadoSessao(): Promise<EstadoSessaoConteudo> {
    if (sessao && deps.agora() - sessao.em < INTERVALO_SESSAO_MS) return sessao.estado;
    const resultado = await deps.requisitar("/api/extension/session", "GET");
    const efeito = estadoPorStatus(resultado.status, resultado.retryAfter);
    const estado: EstadoSessaoConteudo = efeito.tipo === "conectada" ? "ativa" : efeito.tipo === "expirada" ? "sem-sessao" : "desconhecida";
    sessao = { estado, em: deps.agora() };
    return estado;
  }

  async function sincronizar(): Promise<void> {
    // Qualquer invalidação durante os awaits desta rodada cancela a rodada: a versão muda e ela para.
    const inicio = versao;
    if (!deps.pronto()) {
      lastPhone = "";
      lastEstado = null;
      return deps.ocultar();
    }
    const estadoDaSessao = await estadoSessao();
    if (inicio !== versao) return;
    deps.aoEstadoSessao(estadoDaSessao);
    if (estadoDaSessao === "sem-sessao") {
      lastPhone = "";
      lastEstado = null;
      return mostrar({ tipo: "sem-conexao" }, null);
    }
    if (deps.agora() < pausaAte) return;

    const conversa = await deps.conversa();
    if (inicio !== versao) return;
    if (!conversa?.phone) {
      lastPhone = "";
      lastEstado = null;
      return deps.ocultar();
    }
    if (conversa.phone === lastPhone) {
      if (lastEstado) mostrar(lastEstado.estado, lastEstado.selo);
      return;
    }
    lastPhone = conversa.phone;
    const minhaVersao = ++versao;
    mostrar({ tipo: "carregando" }, null);
    const resultado = await deps.requisitar("/api/extension/leads/resolve", "POST", { phone: conversa.phone });
    // 401 vale sempre (privacidade): limpa a tela mesmo que a conversa tenha mudado.
    const efeito = estadoPorStatus(resultado.status, resultado.retryAfter);
    if (efeito.tipo === "expirada") {
      invalidar();
      sessao = { estado: "sem-sessao", em: deps.agora() };
      return mostrar({ tipo: "sem-conexao" }, null);
    }
    // A conversa pode ter mudado durante a chamada: só mostra se ainda for a mesma.
    const atual = await deps.conversa();
    if (minhaVersao !== versao || conversa.phone !== lastPhone || atual?.phone !== conversa.phone) return;
    if (efeito.tipo === "indisponivel") {
      lastPhone = "";
      return mostrar({ tipo: "indisponivel" }, null);
    }
    if (efeito.tipo === "limitada") {
      lastPhone = "";
      pausaAte = deps.agora() + efeito.esperaSegundos * 1000;
      return mostrar({ tipo: "erro" }, null);
    }
    if (efeito.tipo === "falha") {
      lastPhone = "";
      pausaAte = deps.agora() + PAUSA_FALHA_MS;
      return mostrar({ tipo: "erro" }, null);
    }
    const estado = estadoDoResolve(resultado.body as { status: string; lead?: Record<string, unknown> });
    if (!estado) {
      lastEstado = null;
      return deps.ocultar();
    }
    const selo = estado.tipo === "lead" ? { etapa: estado.lead.etapa, temperatura: estado.lead.temperatura } : null;
    mostrar(estado, selo);
  }

  return { sincronizar, invalidar };
}
