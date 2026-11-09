import { z } from "zod";

/**
 * Conversa inteligente do pós-venda (09/11): além da resposta à pergunta da vez, cada mensagem do
 * cliente é lida em busca de intenções que valem em qualquer etapa (pedido de preço, quer falar com
 * alguém, reclamação, número errado, urgência de saúde...). Puro, sem I/O: a tela também importa.
 * A IA devolve a leitura; se falhar, valem as palavras-chave de `detectPostSaleIntents`.
 */

export const POST_SALE_INTENTS = [
  "price_request",
  "wants_human",
  "scheduling",
  "complaint",
  "praise",
  "closed",
  "closed_elsewhere",
  "gave_up",
  "wrong_person",
  "opt_out",
  "question",
  "health_urgency",
] as const;
export type PostSaleIntent = (typeof POST_SALE_INTENTS)[number];

export const COMPLAINT_KINDS = ["rude", "slow", "disappeared", "wrong_info", "other"] as const;
export type ComplaintKind = (typeof COMPLAINT_KINDS)[number];

export const QUESTION_TOPICS = ["coverage", "carencia", "network", "documents", "other"] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

/** Campos de intenção que a IA preenche junto com a resposta da pergunta. */
export const postSaleIntentFields = {
  intents: z.array(z.enum(POST_SALE_INTENTS)).max(12).nullable().optional(),
  complaintKind: z.enum(COMPLAINT_KINDS).nullable().optional(),
  quote: z.string().max(300).nullable().optional(),
  closedWith: z.string().max(80).nullable().optional(),
  gaveUpReason: z.string().max(200).nullable().optional(),
  questionTopic: z.enum(QUESTION_TOPICS).nullable().optional(),
  scheduleText: z.string().max(120).nullable().optional(),
};

export const postSaleIntentReadingSchema = z.object(postSaleIntentFields);
export type PostSaleIntentReading = z.infer<typeof postSaleIntentReadingSchema>;

export const INTENT_LABELS: Record<PostSaleIntent, string> = {
  price_request: "Pediu valores",
  wants_human: "Quer falar com alguém",
  scheduling: "Pediu contato em horário",
  complaint: "Reclamou do atendimento",
  praise: "Elogiou",
  closed: "Já fechou",
  closed_elsewhere: "Fechou por fora",
  gave_up: "Desistiu",
  wrong_person: "Número errado",
  opt_out: "Pediu para parar",
  question: "Fez uma pergunta",
  health_urgency: "Urgência de saúde",
};

export const COMPLAINT_KIND_LABELS: Record<ComplaintKind, string> = {
  rude: "grosseria",
  slow: "demora",
  disappeared: "sumiu ou não respondeu",
  wrong_info: "informação errada ou despreparo",
  other: "outro",
};

export const QUESTION_TOPIC_LABELS: Record<QuestionTopic, string> = {
  coverage: "cobertura",
  carencia: "carência",
  network: "rede e hospitais",
  documents: "documentos",
  other: "outro assunto",
};

/** Intenções que pedem a equipe de volta ao atendimento (alerta "Quer retomar o atendimento"). */
export const RESUME_INTENTS: readonly PostSaleIntent[] = ["price_request", "wants_human", "scheduling"];

function normalize(text: string | null | undefined) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9?:, ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRICE_WORD = /\b(valor|valores|preco|precos|quanto (custa|fica|sai|seria|e)|cotacao|cotacoes|orcamento|simulacao|tabela|mensalidade)\b/;
const REQUEST_CUE = /(\?|\b(quero|queria|gostaria|manda|mande|me (passa|passe|envia|envie|manda|mande|informa|informe|diz|diga)|pode(m)? (me )?(mandar|passar|enviar|informar|fazer)|qual|quais|quanto|preciso|saber|ver)\b)/;
const WANTS_HUMAN = /\b(falar com (o |a |um |uma )?(corretor|corretora|atendente|alguem|uma pessoa|pessoa|humano|voces|vcs|responsavel|gerente)|quero (ser )?atendid|me (liga|ligue|ligar|chama|chame|retorna|retorne|procura|procure)|pode(m)? me (ligar|chamar|retornar)|liga pra mim|liguem|preciso de (um )?atendimento|retomar (o )?atendimento|continuar (o )?atendimento|quero (continuar|fechar|contratar|fazer o plano)|quero seguir)\b/;
const NEGATED_CALL = /\bnao (me )?(liga|ligue|ligar|chama|chame|precisa ligar)\b/;
const TIME_EXPR = /\b(amanha|hoje|depois de amanha|segunda|terca|quarta|quinta|sexta|sabado|semana que vem|proxima semana|mais tarde|depois do almoco|a tarde|de tarde|pela manha|de manha|a noite|\d{1,2} ?(h|hs|horas)\b|\d{1,2}:\d{2})/;
const CONTACT_CUE = /\b(liga|ligue|ligar|ligacao|chama|chame|chamar|retorna|retorne|retornar|retorno|fala|falar|contato|me procura|pode ser|disponivel|livre|atender)\b/;
const COMPLAINT = /\b(grosso|grossa|grosseir\w*|mal educad\w*|ignorou|me ignor\w*|falta de respeito|descaso|sumiu|desapareceu|ninguem (me )?(respond\w*|retorn\w*|atend\w*|lig\w*|cham\w*)|nunca (me )?(respond\w*|retorn\w*)|nao (me )?(respondeu|responderam|retornou|retornaram|atendeu|atenderam)|vacuo|demor(ou|aram|a muito|ando)|muita demora|demorad\w*|enrol\w*|informac\w* errad\w*|inform\w* errado|passou errado|falou errado|mentiu|me engan\w*|pessimo|atendimento (ruim|horrivel|pessimo|fraco|demorado)|despreparad\w*|nao (esta|e) preparad\w*|nao sabe (o |os )?(preco|valor))/;
const PRAISE = /\b(otimo|otima|excelente|maravilhos\w*|muito bom|muito boa|atencios\w*|prestativ\w*|nota 10|nota dez|gostei muito|amei|parabens|super bem atendid\w*|bem atendid\w*|atendeu muito bem)\b/;
const CLOSED = /\b(ja (fiz|fechei|fechamos|contratei|contratamos|assinei|tenho o plano|estou com o plano)|fechei|fechamos|contratei|contratamos|fiz o plano|assinei (o )?contrato)\b/;
const NOT_CLOSED = /\b(nao|ainda nao) (fechei|fechamos|contratei|contratamos|fiz)\b/;
const ELSEWHERE = /\b(outra (corretora|empresa|operadora|seguradora)|outro (corretor|lugar)|por fora|direto (com|na|no) (a |o )?(operadora|banco)|pelo banco|pela empresa|da empresa onde|ja (tenho|temos|possuo) (um |uma )?(plano|convenio))\b/;
const GAVE_UP = /\b(desisti|desistimos|desistir|nao tenho (mais )?interesse|sem interesse|perdi o interesse|nao quero mais (o plano|plano|contratar|fazer|nada)|deixa pra la|deixa para la|deixei pra la|nao vou (mais )?(fazer|contratar|fechar)|mudei de ideia|nao (e|eh) o momento|(no momento|agora|por enquanto) nao (esta|ta) dando|nao (esta|ta) dando (pra|para) (fazer|pagar|contratar)|nao tenho condic\w*)\b/;
const WRONG_PERSON = /\b(numero errado|pessoa errada|contato errado|foi engano|e engano|por engano|nao conheco (ninguem|essa pessoa|esse|essa|nenhum)|nao sou (eu|essa pessoa|esse|essa|quem|o [a-z]+|a [a-z]+)\b|nunca pedi|nao pedi (nada|nenhum|cotacao|plano)|nao solicitei|quem e (voce|vc|voces))/;
const OPT_OUT = /\b(pare de|parar de|para de me|pare|parar|remova|remover|me tira (da|dessa|desse)|nao me (chame|mande|envie|procure|perturbe)|nao quero (mais )?receber|cancele|nao quero mais mensag\w*)\b/;
const QUESTION_CUE = /(\?|^(qual|quais|como|onde|aonde|tem|atende|aceita|cobre|quanto|e se|se eu|quando)\b|\b(quero|queria|gostaria de|preciso) saber\b|\b(vcs|voces) (compram|aceitam|cobrem|atendem|trabalham)\b|\bduvida\b)/;
const QUESTION_TOPICS_RE: Array<[QuestionTopic, RegExp]> = [
  ["carencia", /\bcarencia\w*\b/],
  ["network", /\b(rede|credenciad\w*|hospita\w*|clinica\w*|laboratorio\w*|atende (em|na|no|aqui)|atendimento (em|na|no|aqui|hospitalar))\b/],
  ["coverage", /\b(cobre|cobertura|coparticipa\w*|participativ\w*|reembolso|parto|maternidade|internac\w*|urgencia e emergencia|ambulatorial|enfermaria|apartamento)\b/],
  ["documents", /\b(documento\w*|cnpj|mei|cpf|comprovante|contrato|carteirinha|boleto)\b/],
];
const HEALTH_URGENCY = /\b(passando mal|to passando|estou internad\w*|to internad\w*|esta internad\w*|ta internad\w*|emergencia agora|socorro|infarto|avc|desmai\w*|sangrando|nao consigo respirar|falta de ar|dor no peito|preciso de (um )?hospital agora|estou na (emergencia|upa)|to na (emergencia|upa)|no pronto socorro agora)\b/;

/** Dia e hora pedidos, no jeito que o cliente escreveu (com acento): "amanhã às 10h". */
export function extractScheduleText(text: string): string | null {
  const lower = text.toLowerCase();
  const day = "(?:depois de amanh[ãa]|amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|semana que vem|pr[óo]xima semana|mais tarde|depois do almo[çc]o)(?:-feira)?";
  const period = "(?:(?:pela|de|à|a) (?:manh[ãa]|tarde|noite))";
  const hour = "(?:(?:[àa]s?|depois das|antes das|a partir das|umas|tipo) ?\\d{1,2}(?:[:h]\\d{2}|h| ?horas?| ?hs)?|\\d{1,2}(?::\\d{2}|h\\d{0,2}| ?horas))";
  const pattern = new RegExp(`(${day}(?:,? ?${period})?(?:,? ?${hour})?|${period}(?:,? ?${hour})?|${hour}(?:,? ?${period})?)`, "i");
  const match = lower.match(pattern);
  if (!match || match.index === undefined) return null;
  return text.slice(match.index, match.index + match[0].length).trim().slice(0, 120) || null;
}

/** Leitura das intenções por palavras-chave, usada quando a IA falha. Preferência por precisão. */
export function detectPostSaleIntents(text: string): PostSaleIntentReading {
  const value = normalize(text);
  const intents = new Set<PostSaleIntent>();
  const quote = text.trim().slice(0, 300) || null;
  let complaintKind: ComplaintKind | null = null;
  let closedWith: string | null = null;
  let gaveUpReason: string | null = null;
  let questionTopic: QuestionTopic | null = null;
  let scheduleText: string | null = null;
  if (!value) return { intents: [] };

  if (OPT_OUT.test(value)) intents.add("opt_out");
  if (WRONG_PERSON.test(value)) intents.add("wrong_person");
  if (HEALTH_URGENCY.test(value)) intents.add("health_urgency");
  if (PRICE_WORD.test(value) && REQUEST_CUE.test(value) && !/\b(alto|caro|cara|carissimo|absurdo|pago|pagava|paguei)\b/.test(value)) intents.add("price_request");
  if (WANTS_HUMAN.test(value) && !NEGATED_CALL.test(value)) intents.add("wants_human");
  if (TIME_EXPR.test(value) && CONTACT_CUE.test(value) && !NEGATED_CALL.test(value)) {
    scheduleText = extractScheduleText(text);
    if (scheduleText) intents.add("scheduling");
  }
  if (COMPLAINT.test(value)) {
    intents.add("complaint");
    complaintKind = /\b(grosso|grossa|grosseir|mal educad|ignor|falta de respeito|descaso)/.test(value) ? "rude"
      : /\b(sumiu|desapareceu|ninguem|nunca|nao (me )?(respondeu|responderam|retornou|retornaram|atendeu|atenderam)|vacuo)/.test(value) ? "disappeared"
        : /\b(demor|enrol)/.test(value) ? "slow"
          : /\b(errad|errado|mentiu|engan|despreparad|preparad|nao sabe)/.test(value) ? "wrong_info"
            : "other";
  }
  if (PRAISE.test(value) && !intents.has("complaint") && !/\bmal educad/.test(value)) intents.add("praise");
  if (CLOSED.test(value) && !NOT_CLOSED.test(value)) {
    intents.add("closed");
    const withMatch = text.match(/\bcom (?:o |a |os |as )?([A-ZÀ-Ú][\wÀ-ú]+(?: [A-ZÀ-Ú][\wÀ-ú]+)?)/);
    closedWith = withMatch ? withMatch[1].slice(0, 80) : null;
    if (ELSEWHERE.test(value)) intents.add("closed_elsewhere");
  } else if (/\bja (tenho|temos|possuo) (um |uma )?(plano|convenio)\b/.test(value) && !/\b(vendo|procurando|cotando|quero|queria|gostaria|preciso|trocar|mudar)\b/.test(value)) {
    intents.add("closed_elsewhere");
  }
  if (GAVE_UP.test(value)) {
    intents.add("gave_up");
    gaveUpReason = quote ? quote.slice(0, 200) : null;
  }
  if (QUESTION_CUE.test(value)) {
    for (const [topic, pattern] of QUESTION_TOPICS_RE) {
      if (pattern.test(value)) {
        questionTopic = topic;
        break;
      }
    }
    if (questionTopic) intents.add("question");
  }
  return {
    intents: [...intents],
    complaintKind,
    quote: intents.has("complaint") || intents.has("price_request") || intents.has("wants_human") || intents.has("question") || intents.has("health_urgency") ? quote : null,
    closedWith,
    gaveUpReason,
    questionTopic,
    scheduleText,
  };
}

/** Estado acumulado das intenções da pesquisa, guardado em `post_sale_surveys.answers.intents`. */
export type PostSaleIntentState = {
  list: PostSaleIntent[];
  complaintKind?: ComplaintKind | null;
  complaintQuote?: string | null;
  requestQuote?: string | null;
  closedWith?: string | null;
  gaveUpReason?: string | null;
  questionTopic?: QuestionTopic | null;
  questionText?: string | null;
  scheduleText?: string | null;
};

function isIntent(value: unknown): value is PostSaleIntent {
  return typeof value === "string" && (POST_SALE_INTENTS as readonly string[]).includes(value);
}

export function readIntentState(answers: unknown): PostSaleIntentState | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const raw = (answers as Record<string, unknown>).intents;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const list = Array.isArray(record.list) ? record.list.filter(isIntent) : [];
  const text = (key: string) => typeof record[key] === "string" && record[key] ? String(record[key]) : null;
  return {
    list,
    complaintKind: (COMPLAINT_KINDS as readonly string[]).includes(String(record.complaintKind)) ? record.complaintKind as ComplaintKind : null,
    complaintQuote: text("complaintQuote"),
    requestQuote: text("requestQuote"),
    closedWith: text("closedWith"),
    gaveUpReason: text("gaveUpReason"),
    questionTopic: (QUESTION_TOPICS as readonly string[]).includes(String(record.questionTopic)) ? record.questionTopic as QuestionTopic : null,
    questionText: text("questionText"),
    scheduleText: text("scheduleText"),
  };
}

/** Soma a leitura deste turno ao que já foi dito antes (intenções não se apagam). */
export function mergeIntentState(previous: PostSaleIntentState | null, reading: PostSaleIntentReading, text: string): PostSaleIntentState {
  const list = [...new Set([...(previous?.list ?? []), ...(reading.intents ?? [])])];
  const has = (intent: PostSaleIntent) => (reading.intents ?? []).includes(intent);
  const quote = (reading.quote ?? text).trim().slice(0, 300) || null;
  return {
    list,
    complaintKind: has("complaint") ? reading.complaintKind ?? "other" : previous?.complaintKind ?? null,
    complaintQuote: has("complaint") ? quote : previous?.complaintQuote ?? null,
    requestQuote: has("price_request") || has("wants_human") || has("scheduling") || has("health_urgency") ? quote : previous?.requestQuote ?? null,
    closedWith: reading.closedWith ?? previous?.closedWith ?? null,
    gaveUpReason: has("gave_up") ? (reading.gaveUpReason ?? quote)?.slice(0, 200) ?? null : previous?.gaveUpReason ?? null,
    questionTopic: has("question") ? reading.questionTopic ?? "other" : previous?.questionTopic ?? null,
    questionText: has("question") ? quote : previous?.questionText ?? null,
    scheduleText: reading.scheduleText ?? previous?.scheduleText ?? null,
  };
}

export function hasIntent(state: PostSaleIntentState | null | undefined, ...intents: PostSaleIntent[]) {
  return Boolean(state && intents.some((intent) => state.list.includes(intent)));
}

/** "Fechei com o Alan": o nome dito é o do corretor da pesquisa? */
export function closedWithBroker(closedWith: string | null | undefined, brokerFirstName: string | null | undefined) {
  const a = normalize(closedWith);
  const b = normalize(brokerFirstName);
  return Boolean(a && b && b !== "corretor" && a.split(" ").includes(b));
}

/** Instruções da IA para ler um turno: a resposta da pergunta da vez e as intenções da mensagem toda. */
export function postSaleReadingInstructions(input: { step: number; question: string; broker: string; askLossCategory: boolean; r0?: boolean }) {
  const lossCategory = input.askLossCategory
    ? " Em lossCategory, classifique o motivo dito: price (preço, valor, mensalidade), has_plan (já tem plano ou fechou com outra corretora ou operadora), gave_up (desistiu, sem interesse, não é o momento), not_attended (não foi atendido, ninguém respondeu ou retornou), coverage (documentação, carência, rede, hospitais, cobertura), other (outro motivo); null se não disse motivo."
    : "";
  const head = input.r0
    ? "O cliente já tinha falado com um corretor e voltou a escrever. A pergunta foi: você chegou a ser atendido e recebeu a cotação? Classifique a resposta em category: not_attended (não foi atendido ou não recebeu cotação), wants_more (foi atendido e quer cotação nova, ajuste ou tirar dúvida), closed_or_gave_up (já fechou, inclusive com outra empresa, ou desistiu; informe closedKind closed_elsewhere ou gave_up), other_subject (outro assunto). request: o pedido do cliente em poucas palavras, ou null. reason: motivo de desistência, se dito."
    : `Você lê a resposta de um cliente numa pesquisa de pós-venda de plano de saúde pelo WhatsApp. Pergunta da etapa ${input.step}: ${input.question}. O corretor do cliente se chama ${input.broker}. Preencha os campos da resposta só com fatos explícitos ditos em qualquer parte da mensagem (desconhecido = null ou unknown): contacted (falou com o corretor), speed, rating (1 a 5), sentiment (sobre o atendimento, não sobre a vida), receivedQuote (recebeu cotação; pedir cotação não é ter recebido), closed (fechou o plano), wantsHelp, reason, recommends, optOut.${lossCategory} Na etapa 0, "pode perguntar", "sim", "ok" só autorizam a pesquisa: não são fatos.`;
  return `${head}
Em intents, liste tudo o que aparece na mensagem, mesmo fora da pergunta: price_request (pede preço, valor, cotação ou simulação; dizer quanto já paga não é pedido), wants_human (quer falar com o corretor, um atendente ou alguém agora, ou pede para ligarem), scheduling (diz dia ou horário para ser contatado; copie em scheduleText como o cliente escreveu, por exemplo "amanhã às 10h"), complaint (reclama do corretor ou do atendimento; complaintKind: rude grosseria, slow demora, disappeared sumiu ou não respondeu, wrong_info informação errada ou despreparo, other), praise (elogia o atendimento), closed (diz que já fechou ou contratou; closedWith: com quem, se disse), closed_elsewhere (fechou com outra corretora, outra empresa ou por fora, ou já tem plano de outro lugar), gave_up (desistiu, sem interesse, não é o momento; gaveUpReason: o porquê), wrong_person (número errado, não é a pessoa, não pediu nada), opt_out (pede claramente para não receber mais mensagens; "não quero mais o plano" é gave_up, não opt_out), question (pergunta sobre cobertura, carência, rede, hospitais ou documentos; questionTopic: coverage, carencia, network, documents ou other), health_urgency (emergência de saúde acontecendo agora; contar um caso do passado não é urgência).
quote: trecho literal da reclamação ou do pedido, até 200 caracteres. Use lista vazia quando não houver intenção. Não escreva resposta ao cliente e não estime preço, cobertura ou carência.`;
}
