/**
 * Links rastreáveis (Marketing > Links, 26/11/2026): regras puras, sem banco.
 * - O código curto de /r/<code> sai de um alfabeto sem letras ambíguas (sem 0/o, 1/l/i).
 * - O redirecionamento preserva as UTMs que chegaram na URL; as do link só preenchem o que faltar.
 * - No WhatsApp, a mensagem pronta leva "(código abc1234)": é assim que a conversa que chega volta para o link.
 * - No formulário, o código vai como ?lk=<code> e o envio do formulário devolve a origem ao servidor.
 */

export const LINK_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const LINK_CODE_LENGTH = 7;
const CODE_PATTERN = new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`);

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

export type TrackingLinkDestination = "whatsapp" | "form";
export type TrackingLinkStatus = "active" | "paused";

/** O que o redirecionamento precisa saber do link (nada do tenant além disso). */
export type RedirectLink = {
  code: string;
  destination: TrackingLinkDestination;
  whatsappPhone: string | null;
  whatsappMessage: string | null;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
};

/** Código aleatório de 7 caracteres. `random` devolve bytes (crypto no servidor; fixo nos testes). */
export function generateLinkCode(random: (size: number) => Uint8Array): string {
  const bytes = random(LINK_CODE_LENGTH * 2);
  let code = "";
  // Rejeita bytes acima do maior múltiplo do alfabeto para não favorecer letras.
  const limit = 256 - (256 % LINK_CODE_ALPHABET.length);
  for (const byte of bytes) {
    if (byte >= limit) continue;
    code += LINK_CODE_ALPHABET[byte % LINK_CODE_ALPHABET.length];
    if (code.length === LINK_CODE_LENGTH) return code;
  }
  // Raro (bytes demais rejeitados): completa com outra rodada.
  return code + generateLinkCode(random).slice(code.length);
}

export function normalizeLinkCode(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : null;
}

const REF_PATTERN = new RegExp(`\\(c[oó]digo:?\\s+([${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}})\\)`, "i");

/** Mensagem pronta do WhatsApp com o código no fim, para a conversa voltar para o link. */
export function whatsappMessageWithRef(message: string | null, code: string) {
  const text = (message ?? "").trim();
  return `${text ? `${text} ` : ""}(código ${code})`;
}

/** O código do link na primeira mensagem do cliente, se ele não apagou. */
export function extractLinkRef(text: string | null | undefined): string | null {
  const match = REF_PATTERN.exec(text ?? "");
  return match ? normalizeLinkCode(match[1]) : null;
}

const clean = (value: string | null | undefined, max = 120) => {
  const text = (value ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
  return text || null;
};

/** As UTMs que chegaram na URL (só as cinco conhecidas, curtas e sem caracteres de controle). */
export function readUtm(params: URLSearchParams): UtmParams {
  const utm: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = clean(params.get(key));
    if (value) utm[key] = value;
  }
  return utm;
}

/** As do link preenchem só o que a URL não trouxe. */
export function mergeUtm(link: Pick<RedirectLink, "utmSource" | "utmMedium" | "utmCampaign">, incoming: UtmParams): UtmParams {
  return {
    utm_source: incoming.utm_source ?? link.utmSource,
    ...(incoming.utm_medium ?? link.utmMedium ? { utm_medium: incoming.utm_medium ?? link.utmMedium ?? undefined } : {}),
    ...(incoming.utm_campaign ?? link.utmCampaign ? { utm_campaign: incoming.utm_campaign ?? link.utmCampaign ?? undefined } : {}),
    ...(incoming.utm_content ? { utm_content: incoming.utm_content } : {}),
    ...(incoming.utm_term ? { utm_term: incoming.utm_term } : {}),
  };
}

export const PUBLIC_FORM_PATH = "/formulario";

/**
 * Para onde /r/<code> manda. Formulário: o próprio site, com ?lk e as UTMs. WhatsApp: wa.me com a mensagem pronta
 * (o WhatsApp não carrega UTM; a origem volta pelo código na mensagem). Sem número válido, cai no formulário.
 */
export function buildRedirectTarget(link: RedirectLink, incoming: URLSearchParams, origin: string): string {
  const utm = mergeUtm(link, readUtm(incoming));
  const phone = (link.whatsappPhone ?? "").replace(/\D/g, "");
  if (link.destination === "whatsapp" && phone.length >= 10) {
    const target = new URL(`https://wa.me/${phone}`);
    target.searchParams.set("text", whatsappMessageWithRef(link.whatsappMessage, link.code));
    return target.toString();
  }
  const target = new URL(PUBLIC_FORM_PATH, origin);
  target.searchParams.set("lk", link.code);
  for (const key of UTM_KEYS) if (utm[key]) target.searchParams.set(key, utm[key]!);
  return target.toString();
}

/** Origem que o formulário público manda junto com as respostas (lida da URL no navegador). */
export type FormOrigin = UtmParams & { link?: string };

export function readFormOrigin(search: string): FormOrigin | undefined {
  const params = new URLSearchParams(search);
  const utm = readUtm(params);
  const link = normalizeLinkCode(params.get("lk"));
  const origin: FormOrigin = { ...utm, ...(link ? { link } : {}) };
  return Object.keys(origin).length ? origin : undefined;
}

/** O que entra em leads.source_metadata: o link e as UTMs, só texto curto. */
export function attributionMetadata(
  link: { id: string; code: string; name: string; utmSource: string; utmMedium: string | null; utmCampaign: string | null } | null,
  utm: UtmParams = {},
): Record<string, string> {
  const merged = link ? mergeUtm(link, utm) : utm;
  const out: Record<string, string> = {};
  if (link) {
    out.trackingLinkId = link.id;
    out.trackingLinkCode = link.code;
    out.trackingLinkName = link.name;
  }
  for (const key of UTM_KEYS) if (merged[key]) out[key] = merged[key]!;
  return out;
}

export const LINK_NAME_MAX = 80;
export const LINK_MESSAGE_MAX = 400;

export type TrackingLinkInput = {
  name: string;
  destination: TrackingLinkDestination;
  whatsappPhone?: string | null;
  whatsappMessage?: string | null;
  utmSource: string;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export type ValidLinkInput = {
  name: string;
  destination: TrackingLinkDestination;
  whatsappPhone: string | null;
  whatsappMessage: string | null;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string | null;
};

/** UTM sem espaço e em minúsculas, como as ferramentas de análise esperam ("Instagram Bio" vira "instagram-bio"). */
export function slugUtm(value: string | null | undefined): string | null {
  const slug = (value ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || null;
}

export function validateLinkInput(input: TrackingLinkInput): { ok: true; data: ValidLinkInput } | { ok: false; error: string } {
  const name = clean(input?.name, LINK_NAME_MAX);
  if (!name) return { ok: false, error: "Dê um nome ao link, como Instagram bio." };
  const destination = input.destination === "whatsapp" ? "whatsapp" : input.destination === "form" ? "form" : null;
  if (!destination) return { ok: false, error: "Escolha para onde o link leva." };
  const utmSource = slugUtm(input.utmSource);
  if (!utmSource) return { ok: false, error: "Diga a origem, como instagram ou panfleto." };
  let whatsappPhone: string | null = null;
  let whatsappMessage: string | null = null;
  if (destination === "whatsapp") {
    const digits = (input.whatsappPhone ?? "").replace(/\D/g, "");
    const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    if (phone.length < 12 || phone.length > 13) return { ok: false, error: "Escolha o WhatsApp da empresa, com DDD." };
    whatsappPhone = phone;
    whatsappMessage = clean(input.whatsappMessage, LINK_MESSAGE_MAX);
  }
  return {
    ok: true,
    data: { name, destination, whatsappPhone, whatsappMessage, utmSource, utmMedium: slugUtm(input.utmMedium), utmCampaign: slugUtm(input.utmCampaign) },
  };
}

/** Dia (AAAA-MM-DD) no fuso de São Paulo, o mesmo das outras contagens por dia. */
export function saoPauloDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
