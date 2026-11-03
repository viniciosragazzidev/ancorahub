import "server-only";

import { and, eq } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type ObjetivoSugestao = "CONTINUE_ATTENDANCE" | "ASK_MISSING_FIELD" | "HANDLE_OBJECTION" | "REQUEST_DATA" | "FOLLOW_UP" | "SCHEDULE_CALLBACK" | "SEND_QUOTE" | "CLOSE_POLITELY";

export type ContextoSugestao = { nome: string; etapa: string; qualificado: boolean };

/**
 * Textos deterministas, sem IA: escolhidos só pelo objetivo, pelo nome (primeiro nome) e pela qualificação.
 * Nunca inventam preço, prazo ou condição. Quem envia é sempre o corretor.
 */
export function sugestoesDoRoteiro(objetivo: ObjetivoSugestao, contexto: ContextoSugestao): { id: string; tone: "DIRECT" | "CONSULTATIVE"; text: string }[] {
  const primeiro = contexto.nome.trim().split(/\s+/)[0] || "tudo bem";
  const saudacao = primeiro === "tudo bem" ? "Oi" : `Oi, ${primeiro}`;
  const pedido = contexto.qualificado
    ? "Já tenho o que preciso. Vou verificar as melhores opções e te retorno."
    : "Para eu te indicar a melhor opção, pode me contar quantas pessoas vão entrar no plano e em qual cidade você mora?";
  const textos: Record<ObjetivoSugestao, [string, string]> = {
    ASK_MISSING_FIELD: [`${saudacao}. ${pedido}`, `${saudacao}, para seguir com a sua cotação, ${pedido.charAt(0).toLowerCase()}${pedido.slice(1)}`],
    REQUEST_DATA: [`${saudacao}. ${pedido}`, `${saudacao}, para te enviar a proposta certinha, ${pedido.charAt(0).toLowerCase()}${pedido.slice(1)}`],
    CONTINUE_ATTENDANCE: [`${saudacao}. Retomando nossa conversa: consegue me responder o que combinamos?`, `${saudacao}, passando para continuar o seu atendimento. Quando puder, me retorne por aqui.`],
    FOLLOW_UP: [`${saudacao}. Passando para saber se ficou alguma dúvida sobre a sua cotação.`, `${saudacao}, tudo certo por aí? Fico à disposição para o que precisar.`],
    SCHEDULE_CALLBACK: [`${saudacao}. Quando seria um bom horário para eu te ligar?`, `${saudacao}, prefere que eu entre em contato em outro horário?`],
    HANDLE_OBJECTION: [`${saudacao}. Entendo a sua preocupação. Posso explicar melhor as condições?`, `${saudacao}, faz sentido olhar isso com calma. Quer que eu te mostre os detalhes?`],
    SEND_QUOTE: [`${saudacao}. Vou preparar a sua cotação e já te envio.`, `${saudacao}, assim que a cotação estiver pronta eu te encaminho por aqui.`],
    CLOSE_POLITELY: [`${saudacao}. Obrigado pelo contato. Fico à disposição se precisar no futuro.`, `${saudacao}, agradeço a atenção. Qualquer coisa, é só me chamar.`],
  };
  const [direta, consultiva] = textos[objetivo];
  return [
    { id: `${objetivo}-direta`, tone: "DIRECT", text: direta },
    { id: `${objetivo}-consultiva`, tone: "CONSULTATIVE", text: consultiva },
  ];
}

/** Lê só o necessário para a sugestão: primeiro nome, etapa e se o lead já está qualificado. */
export async function contextoDaSugestao(context: TenantContext, leadId: string): Promise<ContextoSugestao | null> {
  const [lead] = await getDatabase().select({ nome: schema.leads.nome, status: schema.leads.status, qualificationStatus: schema.leads.qualificationStatus })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) return null;
  return { nome: lead.nome, etapa: lead.status, qualificado: lead.qualificationStatus === "qualified" };
}
