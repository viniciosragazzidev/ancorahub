import { buildLeadClientInfo, type LeadClientInfoInput } from "./client-info";

/**
 * First message the broker sends to a new lead on WhatsApp (editable there before sending).
 *
 * Written for conversion (29/10), on what the references on first contact agree on:
 * - reads like a person typed it (no emoji or decoration, which reads as a bot) and says who is
 *   talking and from which brokerage, not "seu corretor";
 * - says it is answering right now ("acabei de receber"): the lead is most reachable in the first
 *   minutes after asking for the quote;
 * - shows it already knows what the lead told (plan type, lives, ages, city): the lead does not
 *   repeat it to a person after telling the assistant, and the message reads as personal;
 * - names the value (compare the operators for their budget and coverage), in short paragraphs;
 * - ends with ONE easy question towards the price: lives, then ages (they set the price), then the
 *   hospital of preference; with everything known, it offers to send the options.
 * A WhatsApp nickname ("valcoelho1959") is not used as a name.
 * Neutral wording: the broker's and the lead's gender are unknown.
 */
export type BrokerGreetingInput = {
  leadName: string | null | undefined;
  brokerName?: string | null;
  companyName?: string | null;
  /** PF, PME or PJ. */
  tipo?: string | null;
  planName?: string | null;
  /** "Familiar", "Individual", "Empresarial (PME)"... */
  planType?: string | null;
  livesCount?: number | null;
  /** As the lead told it: "67, 65" or "Titular (67), Cônjuge (65)". */
  ages?: string | null;
  city?: string | null;
  hospital?: string | null;
};

const firstName = (value: string | null | undefined) => (value ?? "").trim().split(/\s+/)[0] ?? "";

/** A person's name, not a WhatsApp nickname or handle: letters only (no digits, @, _ or dots). */
export function looksLikePersonName(value: string | null | undefined) {
  const name = (value ?? "").trim();
  return name.length >= 2 && /^[\p{L}][\p{L}' -]*$/u.test(name) && /\p{Lu}/u.test(name);
}

function planPhrase(planType: string | null, business: boolean) {
  const type = (planType ?? "").toLocaleLowerCase("pt-BR");
  if (type.startsWith("familiar")) return "um plano familiar";
  if (type.startsWith("individual")) return "um plano individual";
  if (type.startsWith("empresarial") || business) return "um plano para a sua empresa";
  if (type.startsWith("ades")) return "um plano por adesão";
  return "um plano de saúde";
}

export function brokerGreeting(input: BrokerGreetingInput | string | null | undefined) {
  const data: BrokerGreetingInput = typeof input === "object" && input !== null ? input : { leadName: input };
  const lead = looksLikePersonName(data.leadName) ? firstName(data.leadName) : "";
  const broker = firstName(data.brokerName);
  const company = (data.companyName ?? "").trim();
  const business = data.tipo === "PME" || data.tipo === "PJ" || /^empresarial/i.test(data.planType ?? "");
  const lives = data.livesCount && Number.isFinite(data.livesCount) && data.livesCount > 0 ? data.livesCount : null;
  const plan = (data.planName ?? "").trim();
  const ages = (data.ages ?? "").trim();
  const city = (data.city ?? "").trim();
  const hospital = (data.hospital ?? "").trim();

  const hello = lead ? `Oi, ${lead}, tudo bem?` : "Oi, tudo bem?";
  const who = broker && company ? `Aqui é ${broker}, da ${company}.` : broker ? `Aqui é ${broker}.` : company ? `Falo da ${company}.` : "";
  const subject = plan ? `do plano ${plan}` : business ? "de plano de saúde para a sua empresa" : "de plano de saúde";
  const opening = [hello, who, `Acabei de receber seu pedido de cotação ${subject} e vou cuidar dele pessoalmente.`].filter(Boolean).join(" ");

  // What the lead already told, so they do not repeat it.
  const knownParts = [
    planPhrase(data.planType ?? null, business),
    lives ? (lives === 1 ? "para 1 pessoa" : `para ${lives} pessoas`) : null,
    ages ? `(idades: ${ages})` : null,
    city ? `em ${city}` : null,
  ];
  const knowsSomething = Boolean(data.planType || lives || ages || city);
  const known = knowsSomething ? `Vi aqui que você procura ${knownParts.filter(Boolean).join(" ")}.` : null;

  const value = business
    ? "Plano empresarial costuma ter um preço bem melhor que o individual. Comparo as principais operadoras pra achar a melhor cobertura pelo menor custo pra empresa."
    : "Comparo as principais operadoras pra te mostrar as opções que cabem no seu orçamento, com a cobertura que você precisa.";

  const question = !lives
    ? business
      ? "Pra eu já te mandar os valores: quantas pessoas entrariam no plano, contando sócios, funcionários e dependentes?"
      : "Pra eu já te mandar os valores: o plano seria só pra você ou pra mais alguém da família?"
    : !ages
      ? "Pra eu já te mandar os valores: qual a idade de cada pessoa que vai entrar no plano?"
      : !hospital
        ? `Pra eu já separar as melhores opções: tem algum hospital ou laboratório de preferência${city ? ` em ${city}` : ""}?`
        : "Com isso já consigo montar sua cotação. Posso te mandar as opções por aqui ainda hoje?";

  return [opening, [known, value].filter(Boolean).join(" "), question].join("\n\n");
}

/** What the lead already told (AI qualification, form, Meta lead form), for the greeting. */
export function greetingFactsFromLead(lead: LeadClientInfoInput): Pick<BrokerGreetingInput, "planType" | "livesCount" | "ages" | "city" | "hospital"> {
  const items = buildLeadClientInfo(lead);
  const value = (key: string) => items.find((item) => item.key === key)?.value?.trim() || null;
  const lives = Number(value("lives")?.match(/\d+/)?.[0]);
  return {
    planType: value("planType"),
    livesCount: Number.isInteger(lives) && lives > 0 ? lives : null,
    ages: value("ages"),
    city: value("city"),
    hospital: value("detail:hospital"),
  };
}

/** Lives and city from the qualification only (kept for callers without the whole lead). */
export function greetingFactsFromQualification(details: unknown) {
  const facts = greetingFactsFromLead({ qualificationDetails: details });
  return { livesCount: facts.livesCount ?? null, city: facts.city ?? null };
}
