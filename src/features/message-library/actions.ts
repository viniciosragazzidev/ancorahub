"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasPermission } from "@/shared/auth/permissions";
import { acceptSuggestedVariations, QUICK_REPLY_SITUATIONS, QUICK_REPLY_VARIABLES, textVariables } from "./catalog";
import { buildStoredVariables, normalizeShortcut, shortcutFromVariables, TEAM_QUICK_REPLY_CATEGORY, TEAM_QUICK_REPLY_VARIABLES, type TeamQuickReply } from "./team-quick-replies";

type Result<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

async function requireMessageManager() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Diretores e Gestores podem alterar mensagens.");
  return context;
}

function failure(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof Error && error.message ? error.message : fallback };
}

const allowedQuickReplyVariables = new Set(QUICK_REPLY_VARIABLES.map((variable) => variable.key));

/** Saves the tenant's text for one AI quick reply situation. Only {{nome}} and {{resumo}} are filled in. */
export async function saveQuickReplyTextAction(input: { ruleKey: string; body: string }): Promise<Result> {
  try {
    const context = await requireMessageManager();
    const situation = QUICK_REPLY_SITUATIONS.find((item) => item.ruleKey === input.ruleKey);
    if (!situation) return { success: false, error: "Situação da IA desconhecida." };
    const body = input.body.trim();
    if (body.length < 3 || body.length > 1000) return { success: false, error: "O texto precisa ter entre 3 e 1000 caracteres." };
    const unknown = textVariables(body).filter((variable) => !allowedQuickReplyVariables.has(variable));
    if (unknown.length) return { success: false, error: `Variável não disponível aqui: ${unknown.map((variable) => `{{${variable}}}`).join(", ")}. Use {{nome}} ou {{resumo}}.` };
    const now = new Date();
    const db = getDatabase();
    await db.insert(schema.aiQuickReplyTemplates).values({
      id: randomUUID(), tenantId: context.tenantId, ruleKey: situation.ruleKey, templateKey: situation.ruleKey,
      body, active: true, updatedBy: context.userId, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.aiQuickReplyTemplates.tenantId, schema.aiQuickReplyTemplates.ruleKey],
      set: { body, active: true, updatedBy: context.userId, updatedAt: now },
    });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "ai_quick_reply_template", entidadeId: situation.ruleKey, acao: "ai_quick_reply.updated" });
    revalidatePath("/atendimento/mensagens");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível salvar o texto.");
  }
}

/** Goes back to the system's default text for one AI quick reply situation. */
export async function resetQuickReplyTextAction(ruleKey: string): Promise<Result> {
  try {
    const context = await requireMessageManager();
    if (!QUICK_REPLY_SITUATIONS.some((item) => item.ruleKey === ruleKey)) return { success: false, error: "Situação da IA desconhecida." };
    const db = getDatabase();
    await db.update(schema.aiQuickReplyTemplates).set({ active: false, updatedBy: context.userId, updatedAt: new Date() })
      .where(and(eq(schema.aiQuickReplyTemplates.tenantId, context.tenantId), eq(schema.aiQuickReplyTemplates.ruleKey, ruleKey)));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "ai_quick_reply_template", entidadeId: ruleKey, acao: "ai_quick_reply.reset" });
    revalidatePath("/atendimento/mensagens");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível voltar ao texto padrão.");
  }
}

const allowedTeamQuickReplyVariables = new Set(TEAM_QUICK_REPLY_VARIABLES.map((variable) => variable.key));

/** Cria ou altera uma resposta rápida da equipe. Só {{nome}} e {{primeiro_nome}} são preenchidos. */
export async function saveTeamQuickReplyAction(input: { id?: string; name: string; shortcut?: string | null; content: string }): Promise<Result<{ id: string }>> {
  try {
    const context = await requireMessageManager();
    const name = input.name.trim();
    const content = input.content.trim();
    const shortcut = normalizeShortcut(input.shortcut);
    if (name.length < 2 || name.length > 80) return { success: false, error: "O título precisa ter entre 2 e 80 caracteres." };
    if (content.length < 3 || content.length > 2000) return { success: false, error: "O texto precisa ter entre 3 e 2000 caracteres." };
    const unknown = textVariables(content).filter((variable) => !allowedTeamQuickReplyVariables.has(variable));
    if (unknown.length) return { success: false, error: `Variável não disponível aqui: ${unknown.map((variable) => `{{${variable}}}`).join(", ")}. Use {{primeiro_nome}} ou {{nome}}.` };

    const db = getDatabase();
    const others = await db.select({ id: schema.messageTemplates.id, variables: schema.messageTemplates.variables }).from(schema.messageTemplates)
      .where(and(
        eq(schema.messageTemplates.tenantId, context.tenantId),
        eq(schema.messageTemplates.category, TEAM_QUICK_REPLY_CATEGORY),
        eq(schema.messageTemplates.active, true),
        ...(input.id ? [ne(schema.messageTemplates.id, input.id)] : []),
      ));
    if (shortcut && others.some((row) => shortcutFromVariables(row.variables) === shortcut)) return { success: false, error: `O atalho /${shortcut} já é de outra resposta. Escolha outro.` };

    const now = new Date();
    const variables = buildStoredVariables(content, shortcut);
    let id = input.id;
    if (id) {
      const updated = await db.update(schema.messageTemplates).set({ name, content, variables, updatedAt: now })
        .where(and(eq(schema.messageTemplates.id, id), eq(schema.messageTemplates.tenantId, context.tenantId), eq(schema.messageTemplates.category, TEAM_QUICK_REPLY_CATEGORY)))
        .returning({ id: schema.messageTemplates.id });
      if (!updated.length) return { success: false, error: "Resposta não encontrada. Recarregue a página." };
    } else {
      id = randomUUID();
      await db.insert(schema.messageTemplates).values({ id, tenantId: context.tenantId, name, category: TEAM_QUICK_REPLY_CATEGORY, content, variables, active: true, createdBy: context.userId, createdAt: now, updatedAt: now });
    }
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "message_template", entidadeId: id, acao: input.id ? "team_quick_reply.updated" : "team_quick_reply.created" });
    revalidatePath("/atendimento/mensagens");
    return { success: true, id };
  } catch (error) {
    return failure(error, "Não foi possível salvar a resposta.");
  }
}

/** Tira uma resposta rápida da equipe do composer (desativa, não apaga). */
export async function removeTeamQuickReplyAction(id: string): Promise<Result> {
  try {
    const context = await requireMessageManager();
    const db = getDatabase();
    const updated = await db.update(schema.messageTemplates).set({ active: false, updatedAt: new Date() })
      .where(and(eq(schema.messageTemplates.id, id), eq(schema.messageTemplates.tenantId, context.tenantId), eq(schema.messageTemplates.category, TEAM_QUICK_REPLY_CATEGORY)))
      .returning({ id: schema.messageTemplates.id });
    if (!updated.length) return { success: false, error: "Resposta não encontrada. Recarregue a página." };
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "message_template", entidadeId: id, acao: "team_quick_reply.removed" });
    revalidatePath("/atendimento/mensagens");
    return { success: true };
  } catch (error) {
    return failure(error, "Não foi possível remover a resposta.");
  }
}

/** As respostas rápidas da empresa para o composer de /conversas: quem atende conversas pode ler. */
export async function listTeamQuickRepliesAction(): Promise<Result<{ replies: TeamQuickReply[] }>> {
  try {
    const context = await getRequiredTenantContext();
    if (!hasPermission(context.role, "acessar_conversas")) return { success: false, error: "Sem acesso às conversas." };
    const { listTeamQuickReplies } = await import("./service");
    return { success: true, replies: await listTeamQuickReplies(context.tenantId) };
  } catch (error) {
    return failure(error, "Não foi possível carregar as respostas rápidas.");
  }
}

const SUGGESTION_TIMEOUT_MS = 12_000;

/**
 * Up to 3 rewordings of a text, for a person to approve. Same meaning and the
 * same variables; nothing is saved here.
 */
export async function suggestMessageVariationsAction(input: { text: string }): Promise<Result<{ suggestions: string[] }>> {
  try {
    const context = await requireMessageManager();
    const text = input.text.trim();
    if (text.length < 8 || text.length > 1500) return { success: false, error: "Escreva o texto (entre 8 e 1500 caracteres) antes de pedir variações." };
    const { createAiRouter } = await import("@/features/ai-agent/model-router");
    const router = await createAiRouter(context.tenantId);
    if (!router.providers.length) return { success: false, error: "Nenhum provedor de IA configurado para sugerir variações." };
    const variables = textVariables(text);
    const system = [
      "Você reescreve mensagens de WhatsApp de uma corretora de planos de saúde, em português do Brasil.",
      "Escreva 3 versões diferentes da mensagem do usuário, com o mesmo sentido, o mesmo tom e tamanho parecido.",
      variables.length
        ? `Mantenha exatamente estas variáveis, escritas igual, cada uma uma vez: ${variables.map((variable) => `{{${variable}}}`).join(", ")}. Não crie outras variáveis.`
        : "Não use variáveis entre chaves.",
      "Não inclua preços, valores, percentuais, carências, descontos nem promessas que a original não tenha.",
      "Responda só com as 3 versões, uma por linha, sem numeração e sem comentários.",
    ].join("\n");
    const call = router.call({ messages: [{ role: "system", content: system }, { role: "user", content: text }], temperature: 0.8, maxTokens: 600 });
    const result = await Promise.race([call, new Promise<null>((resolve) => setTimeout(() => resolve(null), SUGGESTION_TIMEOUT_MS))]);
    if (!result) return { success: false, error: "A IA demorou para responder. Tente de novo." };
    const data = await result.response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const suggestions = acceptSuggestedVariations(text, (data.choices?.[0]?.message?.content ?? "").split(/\n+/));
    if (!suggestions.length) return { success: false, error: "A IA não trouxe variações seguras desta vez. Tente de novo." };
    return { success: true, suggestions };
  } catch (error) {
    return failure(error, "Não foi possível sugerir variações agora.");
  }
}
