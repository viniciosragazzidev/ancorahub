import type { MetaGraphTemplateComponent, MetaTemplateCategory } from "@/features/communication-channels/meta-graph-templates-client";

/**
 * Recommended WhatsApp templates for the qualification (plan
 * docs/implementations/active/2026-10-21-qualificacao-turbo.md §6).
 *
 * Cost since 1/10/2026 (Brazil, per delivered message): MARKETING R$ 0,3217,
 * UTILITY R$ 0,035. The first contact and the first reminder are UTILITY:
 * non-promotional, about the quote the person asked for. Reengagement is
 * MARKETING on purpose (Meta classifies "continue where you left off" as
 * marketing). Every button answers a qualification question or stops the
 * sequence, so a click already qualifies and opens the 24h window.
 * Meta rejects a body that starts or ends with a variable: every text opens
 * with a word ("Olá, {{nome}}" / "Oi, {{nome}}") and ends with plain text.
 */
export type TurboTouch = "t0" | "t1" | "t2" | "t3" | "t4" | "reactivation";

export type RecommendedTemplate = {
  name: string;
  touch: TurboTouch;
  category: MetaTemplateCategory;
  /** Short label for the director's screens. */
  label: string;
  body: string;
  buttons: string[];
  /** Named variables used in the body, with Meta's approval example. */
  examples: Record<string, string>;
};

const PLAN_BUTTONS = ["Só para mim", "Para minha família", "Para minha empresa"];

export const RECOMMENDED_TEMPLATES: readonly RecommendedTemplate[] = [
  {
    name: "anc_t0_direta",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: para quem é o plano",
    body: "Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Para montar as opções certas, me conta: para quem é o plano?",
    buttons: PLAN_BUTTONS,
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t0_canal",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: WhatsApp ou ligação",
    body: "Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Como prefere seguir com o atendimento?",
    buttons: ["Por aqui no WhatsApp", "Prefiro ligação", "Agora não"],
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t0_assistente",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: assistente se apresenta",
    body: "Olá, {{nome}}, aqui é {{nome_bot}}, da {{empresa}}. Vou cuidar do seu pedido de cotação de plano de saúde. Para começar, para quem é o plano?",
    buttons: PLAN_BUTTONS,
    examples: { nome: "Ana", nome_bot: "Clara", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t0_pme",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: plano empresarial",
    body: "Olá, {{nome}}. Recebemos o pedido de cotação de plano de saúde empresarial na {{empresa}}. Para montar a proposta, a empresa já tem CNPJ ativo?",
    buttons: ["Sim, tenho CNPJ", "Sou MEI", "Ainda não tenho"],
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t0_operadora",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: operadora pedida",
    body: "Olá, {{nome}}. Recebemos seu pedido de cotação do plano {{operadora}} na {{empresa}}. Para calcular, me conta: para quem é o plano?",
    buttons: PLAN_BUTTONS,
    examples: { nome: "Ana", operadora: "Amil", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t0_noite",
    touch: "t0",
    category: "UTILITY",
    label: "Primeiro contato: pedido de madrugada",
    body: "Olá, {{nome}}. Recebemos seu pedido de cotação de plano de saúde na {{empresa}}. Quando puder, me conta para quem é o plano e eu já deixo as opções prontas.",
    buttons: PLAN_BUTTONS,
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t1_lembrete",
    touch: "t1",
    category: "UTILITY",
    label: "Lembrete: pedido continua aberto",
    body: "Oi, {{nome}}. Seu pedido de cotação de plano de saúde continua aberto aqui na {{empresa}}. Falta só saber para quem é o plano.",
    buttons: ["Só para mim", "Para minha família", "Prefiro ligação"],
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t2_beneficio",
    touch: "t2",
    category: "MARKETING",
    label: "Reengajamento: comparar operadoras",
    body: "Oi, {{nome}}. Consigo comparar as principais operadoras para você e mostrar as opções que cabem no seu bolso, com a rede de hospitais de cada uma. Quer que eu prepare?",
    buttons: ["Quero ver as opções", "Prefiro ligação", "Agora não"],
    examples: { nome: "Ana" },
  },
  {
    name: "anc_t3_ligacao",
    touch: "t3",
    category: "MARKETING",
    label: "Reengajamento: oferecer ligação",
    body: "Oi, {{nome}}. Se for mais fácil, um especialista da {{empresa}} pode te ligar e explicar as opções de plano de saúde em poucos minutos. Prefere assim?",
    buttons: ["Pode me ligar", "Prefiro por aqui", "Agora não"],
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
  {
    name: "anc_t4_despedida",
    touch: "t4",
    category: "MARKETING",
    label: "Despedida: encerrar ou continuar",
    body: "Oi, {{nome}}. Não quero te incomodar. Posso encerrar seu pedido de cotação de plano de saúde ou ainda quer receber as opções?",
    buttons: ["Quero receber", "Pode encerrar"],
    examples: { nome: "Ana" },
  },
  {
    name: "anc_reativacao",
    touch: "reactivation",
    category: "MARKETING",
    label: "Reativação: lead antigo",
    body: "Oi, {{nome}}. Há alguns dias você pediu uma cotação de plano de saúde na {{empresa}}. Ainda está procurando? Posso te mandar as opções atualizadas.",
    buttons: ["Ainda procuro", "Já resolvi", "Agora não"],
    examples: { nome: "Ana", empresa: "Âncora Saúde" },
  },
];

export function findRecommendedTemplate(name: string) {
  return RECOMMENDED_TEMPLATES.find((template) => template.name === name) ?? null;
}

/** Variable names in body order ({{nome}} before {{empresa}}...). */
export function templateVariableOrder(body: string) {
  const names: string[] = [];
  for (const match of body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) if (!names.includes(match[1])) names.push(match[1]);
  return names;
}

/** Payload for POST /{waba}/message_templates with named parameters. */
export function toMetaTemplatePayload(template: RecommendedTemplate, language = "pt_BR") {
  const variables = templateVariableOrder(template.body);
  const body = {
    type: "BODY" as const,
    text: template.body,
    example: { body_text_named_params: variables.map((name) => ({ param_name: name, example: template.examples[name] ?? name })) },
  };
  const buttons = {
    type: "BUTTONS" as const,
    buttons: template.buttons.map((text) => ({ type: "QUICK_REPLY" as const, text })),
  };
  return {
    name: template.name,
    language,
    category: template.category,
    parameter_format: "NAMED" as const,
    components: [body, buttons] as unknown as MetaGraphTemplateComponent[],
  };
}
