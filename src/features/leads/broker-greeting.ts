/**
 * First message the broker sends to a new lead on WhatsApp (editable there before sending).
 *
 * Written for conversion (29/10), on what the references on first contact agree on:
 * - reads like a person typed it (no emoji or decoration, which reads as a bot) and says who is
 *   talking and from which brokerage, not "seu corretor";
 * - says it is answering right now ("acabei de receber"): the lead is most reachable in the first
 *   minutes after asking for the quote;
 * - names the reason (their quote, the plan when known) and the value (compare the operators for
 *   their budget and coverage), in short paragraphs;
 * - ends with ONE easy question that moves to the price (one call to action; lives first, then the
 *   ages, which set the price of a health plan). What the lead already told is not asked again.
 * Neutral wording: the broker's and the lead's gender are unknown.
 */
export type BrokerGreetingInput = {
  leadName: string | null | undefined;
  brokerName?: string | null;
  companyName?: string | null;
  /** PF, PME or PJ. */
  tipo?: string | null;
  planName?: string | null;
  livesCount?: number | null;
  city?: string | null;
};

const firstName = (value: string | null | undefined) => (value ?? "").trim().split(/\s+/)[0] ?? "";

export function brokerGreeting(input: BrokerGreetingInput | string | null | undefined) {
  const data: BrokerGreetingInput = typeof input === "object" && input !== null ? input : { leadName: input };
  const lead = firstName(data.leadName);
  const broker = firstName(data.brokerName);
  const company = (data.companyName ?? "").trim();
  const business = data.tipo === "PME" || data.tipo === "PJ";
  const lives = data.livesCount && Number.isFinite(data.livesCount) && data.livesCount > 0 ? data.livesCount : null;
  const plan = (data.planName ?? "").trim();

  const hello = lead ? `Oi, ${lead}, tudo bem?` : "Oi, tudo bem?";
  const who = broker && company ? `Aqui é ${broker}, da ${company}.` : broker ? `Aqui é ${broker}.` : company ? `Falo da ${company}.` : "";
  const subject = plan ? `do plano ${plan}` : business ? "de plano de saúde para a sua empresa" : "de plano de saúde";
  const opening = [hello, who, `Acabei de receber seu pedido de cotação ${subject} e vou cuidar dele pessoalmente.`].filter(Boolean).join(" ");

  const value = business
    ? "Plano empresarial costuma ter um preço bem melhor que o individual. Comparo as principais operadoras pra achar a melhor cobertura pelo menor custo pra empresa."
    : "Comparo as principais operadoras pra te mostrar as opções que cabem no seu orçamento, com a cobertura que você precisa.";

  const question = lives
    ? "qual a idade de cada pessoa que vai entrar no plano?"
    : business
      ? "quantas pessoas entrariam no plano, contando sócios, funcionários e dependentes?"
      : "o plano seria só pra você ou pra mais alguém da família?";

  return [opening, value, `Pra eu já te mandar os valores: ${question}`].join("\n\n");
}

/** Lives and city the lead already told (form or AI qualification), for the greeting. */
export function greetingFactsFromQualification(details: unknown): { livesCount: number | null; city: string | null } {
  const record = details && typeof details === "object" && !Array.isArray(details) ? details as Record<string, unknown> : {};
  const read = (key: string) => typeof record[key] === "string" || typeof record[key] === "number" ? String(record[key]).trim() : "";
  const lives = Number(read("qtdVidas") || read("numberOfLives"));
  return { livesCount: Number.isInteger(lives) && lives > 0 ? lives : null, city: read("cidade") || read("city") || null };
}
