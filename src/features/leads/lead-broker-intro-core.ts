import { looksLikePersonName } from "./broker-greeting";

/**
 * "Seu atendimento tem um especialista" (29/10): the message the lead receives on the company's
 * official number when a broker accepts them, with the broker's name and number. Pure, no I/O.
 * Neutral wording: the broker's and the lead's gender are unknown.
 */

export const LEAD_BROKER_INTRO_PURPOSE = "leadBrokerIntroduction";

/** Default text of the event (the director can swap it in Mensagens); {{vars}} follow the catalog. */
export const LEAD_BROKER_INTRO_DEFAULT_MESSAGE = [
  "Oi, {{lead_nome}}! Boa notícia: seu atendimento já tem um especialista dedicado. 🤝",
  "*{{corretor_nome}}*, da *{{empresa}}*, vai cuidar de tudo pra você, da cotação à contratação, comparando as principais operadoras para encontrar o plano certo para o seu perfil e o seu orçamento.",
  "📲 Em instantes {{corretor_nome}} vai te chamar no WhatsApp pelo número *{{corretor_telefone}}*. Salve o contato para não perder nenhuma mensagem.",
  "Qualquer dúvida, é só responder por aqui. Seu atendimento está em boas mãos.",
].join("\n\n");

/** "(21) 99999-8888" from a stored number, with or without the 55. */
export function formatBrokerPhone(phone: string | null | undefined) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return null;
}

/** Variables in the catalog order: lead, broker, broker phone, brokerage. */
export function leadBrokerIntroVariables(input: { leadName: string | null; brokerName: string | null; brokerPhone: string; companyName: string | null }) {
  const first = (value: string | null) => (value ?? "").trim().split(/\s+/)[0] ?? "";
  return [
    // A WhatsApp nickname ("valcoelho1959") is not a name: "Oi, tudo bem!" instead.
    (looksLikePersonName(input.leadName) ? first(input.leadName) : "") || "tudo bem",
    (input.brokerName ?? "").trim().split(/\s+/).slice(0, 2).join(" ") || "Seu especialista",
    input.brokerPhone,
    (input.companyName ?? "").trim() || "nossa corretora",
  ];
}
