import type { PedidoAcao, ResultadoAcao } from "../panel/acoes-lead";
import type { LeadAmpliado } from "../shared/types";

export type RequisicaoAcao = { path: string; metodo: "POST" | "PATCH"; corpo: Record<string, unknown> };

/** Traduz o pedido da gaveta na chamada da API do CRM. A versão enviada é sempre a que a tela mostrou. */
export function requisicaoDaAcao(lead: LeadAmpliado, pedido: PedidoAcao): RequisicaoAcao {
  const base = `/api/extension/leads/${encodeURIComponent(lead.id)}`;
  switch (pedido.tipo) {
    case "etapa":
      return { path: `${base}/status`, metodo: "PATCH", corpo: { statusId: pedido.statusId, expectedVersion: lead.version, ...(pedido.motivoPerda ? { motivoPerda: pedido.motivoPerda } : {}) } };
    case "nota":
      return { path: `${base}/notes`, metodo: "POST", corpo: { conteudo: pedido.conteudo, expectedVersion: lead.version } };
    case "tarefa":
      return { path: `${base}/tasks`, metodo: "POST", corpo: { title: pedido.titulo, expectedVersion: lead.version } };
    case "lembrete":
      return { path: `${base}/reminders`, metodo: "POST", corpo: { when: pedido.when, expectedVersion: lead.version } };
  }
}

/** Resultado para a gaveta. 409 é conflito de versão: a tela recarrega o lead. Erros não expõem detalhe técnico. */
export function resultadoDaAcao(status: number): ResultadoAcao {
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 409) return { ok: false, conflito: true, mensagem: "Este lead mudou em outro lugar. Atualizamos a tela." };
  if (status === 403) return { ok: false, mensagem: "Você não tem permissão para isso agora." };
  if (status === 404) return { ok: false, mensagem: "Este lead não está disponível para você." };
  if (status === 429) return { ok: false, mensagem: "Muitas ações seguidas. Aguarde um pouco." };
  if (status === 0) return { ok: false, mensagem: "Sem conexão com o CRM. Tente de novo." };
  return { ok: false, mensagem: "Não foi possível salvar. Confira os dados e tente de novo." };
}
