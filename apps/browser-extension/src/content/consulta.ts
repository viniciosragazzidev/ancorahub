import { estadoDoResolve } from "../shared/lead-ampliado";
import { estadoPorStatus } from "../shared/estado-sessao";
import type { EstadoGaveta } from "../shared/types";
import type { SeloCabecalho } from "./painel";

/** Resposta do worker. `geracao` é a sessão usada (null = o worker não tinha sessão). */
export type ApiResult = { ok: boolean; status: number; body: Record<string, unknown>; retryAfter?: number; geracao?: string | null };
export type EstadoSessaoConteudo = "ativa" | "sem-sessao" | "indisponivel" | "desconhecida";
export type Conversa = { phone?: string } | null;

// Sessão é conferida no máximo a cada 5 minutos; falha de rede espera 5 segundos antes de tentar de novo.
export const INTERVALO_SESSAO_MS = 5 * 60_000;
export const PAUSA_FALHA_MS = 5_000;

export type DependenciasConsulta = {
  pronto(): boolean;
  conversa(): Promise<Conversa>;
  requisitar(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<ApiResult>;
  mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null): void;
  ocultar(): void;
  /** Esconde na hora, de forma síncrona, quando a sessão muda: nenhum dado antigo fica na tela. */
  neutro(): void;
  aoEstadoSessao(estado: EstadoSessaoConteudo): void;
  agora(): number;
};

/**
 * Consulta do lead na conversa aberta. Regras:
 * - sessão ausente (401) ou sem acesso (403): nada do lead fica visível; a tela mostra só o estado correspondente;
 * - estado desconhecido (rede) nunca reapresenta dado antigo;
 * - invalidar() (troca de conta, revogação, expiração) esconde na hora e descarta toda resposta em voo;
 * - a resposta só é usada se a sessão e a rodada ainda são as de quando foi pedida.
 */
export function criarConsulta(deps: DependenciasConsulta) {
  let epoca = 0;
  let geracaoAtual: string | null = null;
  let sessao: { estado: EstadoSessaoConteudo; em: number } | null = null;
  let pausaAte = 0;
  let lastPhone = "";
  let lastEstado: { estado: EstadoGaveta; selo: SeloCabecalho | null } | null = null;

  function invalidar() {
    epoca++;
    lastPhone = "";
    lastEstado = null;
    pausaAte = 0;
    sessao = null;
    geracaoAtual = null;
    deps.neutro();
  }

  function mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null) {
    lastEstado = { estado, selo };
    deps.mostrar(estado, selo);
  }

  /** Estado da sessão a partir da checagem. Só respostas definitivas entram no cache. */
  async function estadoSessao(): Promise<EstadoSessaoConteudo | "descartada"> {
    if (sessao && deps.agora() - sessao.em < INTERVALO_SESSAO_MS) return sessao.estado;
    const pedidoEm = epoca;
    const resultado = await deps.requisitar("/api/extension/session", "GET");
    if (pedidoEm !== epoca) return "descartada";
    const efeito = estadoPorStatus(resultado.status, resultado.retryAfter);
    if (efeito.tipo === "conectada") {
      geracaoAtual = typeof resultado.geracao === "string" ? resultado.geracao : null;
      sessao = { estado: "ativa", em: deps.agora() };
      return "ativa";
    }
    if (efeito.tipo === "expirada") {
      geracaoAtual = null;
      sessao = { estado: "sem-sessao", em: deps.agora() };
      return "sem-sessao";
    }
    if (efeito.tipo === "indisponivel") {
      geracaoAtual = null;
      sessao = { estado: "indisponivel", em: deps.agora() };
      return "indisponivel";
    }
    // Rede, 5xx ou limite: não se afirma nada, e não se usa cache.
    geracaoAtual = null;
    sessao = null;
    return "desconhecida";
  }

  async function sincronizar(): Promise<void> {
    const epocaInicio = epoca;
    if (!deps.pronto()) {
      lastPhone = "";
      lastEstado = null;
      return deps.ocultar();
    }
    const estado = await estadoSessao();
    if (estado === "descartada" || epoca !== epocaInicio) return;
    deps.aoEstadoSessao(estado);
    if (estado === "sem-sessao") {
      lastPhone = "";
      lastEstado = null;
      return mostrar({ tipo: "sem-conexao" }, null);
    }
    if (estado === "indisponivel") {
      // 403: sem dados do lead; a tela informa a indisponibilidade e nada antigo volta.
      lastPhone = "";
      lastEstado = null;
      return mostrar({ tipo: "indisponivel" }, null);
    }
    if (estado === "desconhecida") {
      lastPhone = "";
      lastEstado = null;
      return mostrar({ tipo: "erro" }, null);
    }
    if (deps.agora() < pausaAte) return;

    const conversa = await deps.conversa();
    if (epoca !== epocaInicio) return;
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
    const minhaEpoca = epoca;
    const geracaoDaRodada = geracaoAtual;
    mostrar({ tipo: "carregando" }, null);
    const resultado = await deps.requisitar("/api/extension/leads/resolve", "POST", { phone: conversa.phone });

    // Antes de qualquer tratamento de 401/403: a resposta só vale se a rodada e a sessão ainda são as dela.
    if (minhaEpoca !== epoca || conversa.phone !== lastPhone) return;
    if (typeof resultado.geracao === "string" && resultado.geracao !== geracaoDaRodada) return;

    const efeito = estadoPorStatus(resultado.status, resultado.retryAfter);
    if (efeito.tipo === "expirada") {
      invalidar();
      sessao = { estado: "sem-sessao", em: deps.agora() };
      return mostrar({ tipo: "sem-conexao" }, null);
    }
    if (efeito.tipo === "indisponivel") {
      lastPhone = "";
      lastEstado = null;
      return mostrar({ tipo: "indisponivel" }, null);
    }
    if (efeito.tipo === "limitada") {
      lastPhone = "";
      lastEstado = null;
      pausaAte = deps.agora() + efeito.esperaSegundos * 1000;
      return mostrar({ tipo: "erro" }, null);
    }
    if (efeito.tipo === "falha") {
      lastPhone = "";
      lastEstado = null;
      pausaAte = deps.agora() + PAUSA_FALHA_MS;
      return mostrar({ tipo: "erro" }, null);
    }
    const dados = estadoDoResolve(resultado.body as { status: string; lead?: Record<string, unknown> });
    if (!dados) {
      lastEstado = null;
      return deps.ocultar();
    }
    const selo = dados.tipo === "lead" ? { etapa: dados.lead.etapa, temperatura: dados.lead.temperatura } : null;
    mostrar(dados, selo);
  }

  return { sincronizar, invalidar };
}
