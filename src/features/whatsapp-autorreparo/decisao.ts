/**
 * Regras puras do auto-reparo das conexões de WhatsApp dos corretores (sem I/O).
 *
 * Diagnóstico de 12/11: o CRM e o relay concordavam (95 error = 95 ERROR no relay). A causa
 * dominante foi um evento em massa (sessões FAILED) e 59 corretores que nunca completaram o
 * pareamento. Por isso o vigia só faz duas coisas: sincroniza "ready" quando o relay diz
 * CONNECTED, e tenta `start` (nunca `recover`, que apaga a autenticação) em sessão que já
 * conectou antes, com backoff e limite diário.
 */

/** Tentativas de start por corretor por dia, no máximo. */
export const LIMITE_STARTS_DIA = 3;
/** Espera (minutos) desde a última tentativa, por ordem: 1, 5, 15. */
export const BACKOFF_MINUTOS = [1, 5, 15] as const;
/** Hora padrão do aviso de véspera (horário de São Paulo). Valor a confirmar com o Vinicios. */
export const HORA_AVISO_PADRAO = 18;

const FUSO = "America/Sao_Paulo";
const STATUS_RELAY_CONECTADO = new Set(["CONNECTED", "WORKING"]);
const STATUS_RELAY_FALHOU = new Set(["ERROR", "FAILED", "STOPPED", "DISCONNECTED"]);

export type AcaoVigia =
  | { tipo: "sincronizar"; status: "ready" }
  | { tipo: "start" }
  | { tipo: "aguardar"; motivo: string }
  | { tipo: "nada"; motivo: string };

export type EntradaVigia = {
  /** Status salvo no CRM (ready, error, disconnected, initializing, paused...). */
  statusCrm: string;
  /** Status devolvido pelo relay (CONNECTED, ERROR, ...). null quando o relay não respondeu. */
  statusRelay: string | null;
  /** A conexão já esteve pronta alguma vez (connected_at preenchido). */
  jaConectou: boolean;
  /** Quantas tentativas de start já foram feitas hoje (São Paulo). */
  startsHoje: number;
  /** Momento da última tentativa de start, se houver. */
  ultimoStartEm: Date | null;
  agora: Date;
  /** Flag de start ligada. Desligada por padrão. */
  startHabilitado: boolean;
};

export function decidirAcaoVigia(entrada: EntradaVigia): AcaoVigia {
  const relay = (entrada.statusRelay ?? "").trim().toUpperCase();
  if (!relay) return { tipo: "nada", motivo: "relay sem resposta" };

  if (STATUS_RELAY_CONECTADO.has(relay)) {
    return entrada.statusCrm === "ready"
      ? { tipo: "nada", motivo: "já pronta no CRM" }
      : { tipo: "sincronizar", status: "ready" };
  }

  if (relay === "PAUSED") return { tipo: "nada", motivo: "pausada pelo CRM" };

  if (!entrada.jaConectou) {
    // Nunca completou o pareamento: reiniciar não resolve. Precisa de QR novo pelo roteiro guiado.
    return { tipo: "aguardar", motivo: "nunca conectou: precisa de QR" };
  }

  if (STATUS_RELAY_FALHOU.has(relay)) {
    if (!entrada.startHabilitado) return { tipo: "nada", motivo: "start desligado (flag)" };
    if (entrada.startsHoje >= LIMITE_STARTS_DIA) return { tipo: "nada", motivo: "limite diário de starts" };
    if (entrada.ultimoStartEm && entrada.agora.getTime() < proximoStartPermitidoEm(entrada).getTime()) {
      return { tipo: "nada", motivo: "aguardando backoff" };
    }
    return { tipo: "start" };
  }

  // SCAN_QR_CODE, STARTING e similares: o celular ainda está pareando. Não mexer.
  return { tipo: "nada", motivo: `em andamento no relay (${relay})` };
}

/** Quando a próxima tentativa é permitida, segundo o número de starts já feitos hoje. */
export function proximoStartPermitidoEm(entrada: Pick<EntradaVigia, "startsHoje" | "ultimoStartEm">): Date {
  if (!entrada.ultimoStartEm) return new Date(0);
  const indice = Math.min(Math.max(entrada.startsHoje - 1, 0), BACKOFF_MINUTOS.length - 1);
  return new Date(entrada.ultimoStartEm.getTime() + BACKOFF_MINUTOS[indice] * 60_000);
}

/** Data (AAAA-MM-DD) em São Paulo. */
export function dataSaoPaulo(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}

/** Hora cheia (0 a 23) em São Paulo. */
export function horaSaoPaulo(instante: Date): number {
  const texto = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(instante);
  return Number(texto.slice(0, 2));
}

/** Data do plantão de amanhã, em São Paulo. */
export function dataPlantaoDeAmanha(agora: Date): string {
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return dataSaoPaulo(amanha);
}

/** O aviso de véspera já pode sair? Sim a partir da hora configurada do dia anterior ao plantão. */
export function avisoDeVesperaLiberado(agora: Date, horaAviso: number): boolean {
  return horaSaoPaulo(agora) >= horaAviso;
}

/** Chave de idempotência: um aviso por corretor por plantão. */
export function chaveAvisoReconexao(corretorId: string, dataPlantao: string): string {
  return `whatsapp-reconexao:${corretorId}:${dataPlantao}`;
}

/** Converte a hora configurada em número válido (0 a 23). Valor inválido volta ao padrão. */
export function horaAvisoValida(texto: string | null | undefined): number {
  if (texto === null || texto === undefined || texto.trim() === "") return HORA_AVISO_PADRAO;
  const numero = Number(texto);
  return Number.isInteger(numero) && numero >= 0 && numero <= 23 ? numero : HORA_AVISO_PADRAO;
}
