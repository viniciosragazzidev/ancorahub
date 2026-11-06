export const POST_SALE_META_TEMPLATE = {
  name: "pos_venda_apresentacao",
  language: "pt_BR",
  category: "UTILITY",
  body: "Olá, {{1}}! Aqui é da equipe de qualidade da {{2}}. Há alguns dias você falou com a gente sobre plano de saúde e o corretor {{3}} ficou responsável pelo seu atendimento. Queremos saber como foi a sua experiência para garantir que você seja bem atendido. Posso te fazer duas perguntas rápidas?",
  quickReplies: ["Pode perguntar", "Agora não"],
  variables: ["cliente_nome", "empresa", "corretor_nome"],
} as const;

export const POST_SALE_WAHA_OPENING_DEFAULT = "Oi, {{nome}}! Tudo bem? Aqui é a {{assistente}}, da equipe de qualidade da {{empresa}}. Faz alguns dias você falou com a gente sobre plano de saúde, e o {{corretor}} ficou responsável pelo seu atendimento. Estou entrando em contato para saber como foi a sua experiência, porque queremos garantir que você seja bem atendido. Posso te fazer duas perguntinhas rápidas?";

export const POST_SALE_OPENING_VARIABLES = ["nome", "assistente", "empresa", "corretor"] as const;

export function isApprovedPostSaleMetaTemplate(input: {
  language: string;
  category: string;
  bodyText: string | null;
  variables: unknown;
  buttons: unknown;
}) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
  const variables = Array.isArray(input.variables) ? input.variables.filter((value): value is string => typeof value === "string") : [];
  const buttons = Array.isArray(input.buttons) ? input.buttons as Array<{ type?: unknown; text?: unknown }> : [];
  return input.language === POST_SALE_META_TEMPLATE.language
    && ["UTILITY", "MARKETING"].includes(input.category)
    && normalize(input.bodyText ?? "") === normalize(POST_SALE_META_TEMPLATE.body)
    && variables.join(",") === "1,2,3"
    && buttons.length === 2
    && buttons.every((button) => button.type === "QUICK_REPLY")
    && buttons.map((button) => button.text).join("|") === POST_SALE_META_TEMPLATE.quickReplies.join("|");
}

