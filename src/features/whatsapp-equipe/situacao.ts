/**
 * WhatsApp da equipe (/integrations/whatsapp, visão da diretoria): regras puras, sem I/O.
 * Classifica a situação do WhatsApp pessoal (WAHA) de cada corretor ativo, ordena quem caiu
 * primeiro e decide a faixa de alerta (mais de 20% dos corretores sem WhatsApp).
 */
import { normalizeWahaUiStatus } from "@/features/waha-cadence/status";

export type SituacaoWhatsApp = "caiu" | "qr" | "nunca" | "conectado";

/** A conexão salva no CRM (`whatsapp_connections`), ou null quando o corretor nunca abriu uma. */
export type ConexaoSalva = { status: string | null; connectedAt: Date | string | null } | null;

export type TentativaVigia = { em: string; resultado: "ok" | "erro" };

export type LinhaWhatsAppEquipe = {
  corretorId: string;
  nome: string;
  unidade: string | null;
  situacao: SituacaoWhatsApp;
  /** Última mudança ou verificação da conexão (ISO), null sem conexão. */
  desde: string | null;
  /** Tentativas de reconexão do vigia hoje (São Paulo), da mais antiga para a mais nova. */
  tentativas: TentativaVigia[];
};

/** Fração de corretores sem WhatsApp a partir da qual a faixa aparece (estritamente maior). */
export const LIMITE_FAIXA = 0.2;

const ORDEM: Record<SituacaoWhatsApp, number> = { caiu: 0, qr: 1, nunca: 2, conectado: 3 };

export const SITUACAO_VIEW: Record<SituacaoWhatsApp, { label: string; tone?: "success" | "warning" | "danger"; explicacao: string }> = {
  caiu: { label: "Caiu", tone: "danger", explicacao: "Já esteve conectado e caiu. O vigia tenta religar sozinho algumas vezes por dia." },
  qr: { label: "Escaneie o QR", tone: "warning", explicacao: "A conexão está esperando o corretor escanear o QR no celular." },
  nunca: { label: "Nunca conectou", explicacao: "O corretor ainda não terminou de conectar o WhatsApp. O vigia não consegue ajudar: precisa do QR." },
  conectado: { label: "Conectado", tone: "success", explicacao: "WhatsApp conectado e registrando as conversas no CRM." },
};

export function classificarSituacao(conexao: ConexaoSalva): SituacaoWhatsApp {
  if (!conexao) return "nunca";
  const status = normalizeWahaUiStatus(conexao.status);
  if (status === "ready") return "conectado";
  if (status === "initializing") return "qr";
  return conexao.connectedAt ? "caiu" : "nunca";
}

export function semWhatsApp(linha: Pick<LinhaWhatsAppEquipe, "situacao">) {
  return linha.situacao !== "conectado";
}

/** Caiu, depois QR, depois nunca conectou, por último conectado; dentro de cada grupo, há mais tempo primeiro. */
export function ordenarLinhas<T extends Pick<LinhaWhatsAppEquipe, "situacao" | "desde" | "nome">>(linhas: readonly T[]): T[] {
  return [...linhas].sort((a, b) => {
    const grupo = ORDEM[a.situacao] - ORDEM[b.situacao];
    if (grupo !== 0) return grupo;
    if (a.desde !== b.desde) {
      if (!a.desde) return 1;
      if (!b.desde) return -1;
      return a.desde < b.desde ? -1 : 1;
    }
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export type FaixaWhatsAppEquipe = { mostrar: boolean; sem: number; total: number; texto: string };

export function faixaWhatsAppEquipe(linhas: readonly Pick<LinhaWhatsAppEquipe, "situacao">[]): FaixaWhatsAppEquipe {
  const total = linhas.length;
  const sem = linhas.filter(semWhatsApp).length;
  const mostrar = total > 0 && sem / total > LIMITE_FAIXA;
  const corretores = total === 1 ? "corretor" : "corretores";
  const verbo = sem === 1 ? "está" : "estão";
  return { mostrar, sem, total, texto: `${sem.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${corretores} ${verbo} sem WhatsApp agora` };
}

/** Lê o resultado gravado pelo vigia no metadata do audit log. */
export function resultadoTentativa(metadata: unknown): TentativaVigia["resultado"] {
  return metadata && typeof metadata === "object" && (metadata as { resultado?: unknown }).resultado === "ok" ? "ok" : "erro";
}

/** Chave idempotente do pedido de reconexão: um pedido por corretor por hora. */
export function chavePedidoReconexao(corretorId: string, agora: Date) {
  return `whatsapp-reconexao-pedido:${corretorId}:${agora.toISOString().slice(0, 13)}`;
}
